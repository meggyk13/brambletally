import { json, error, readJson } from '../../../lib/http.js';
import { notify } from '../../../lib/notify.js';

async function loadRequest(env, listingId, requestId) {
  return env.DB.prepare(
    `SELECT r.id, r.requester_id, r.status, l.project_id, p.owner_id
       FROM contributor_requests r
       JOIN project_listings l ON l.id = r.listing_id
       JOIN projects p ON p.id = l.project_id
      WHERE r.id = ? AND r.listing_id = ?`
  )
    .bind(requestId, listingId)
    .first();
}

// PATCH /api/board/:listingId/requests/:requestId — { status: 'accepted' | 'declined' }.
// Listing owner only. Accepting adds the requester as a `viewer` collaborator in
// the same batch (mirrors resolvePendingInvites).
export async function onRequestPatch(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');
  const { listingId, requestId } = context.params;

  const body = await readJson(context.request);
  const next = body && body.status;
  if (next !== 'accepted' && next !== 'declined')
    return error(400, "status must be 'accepted' or 'declined'");

  const r = await loadRequest(context.env, listingId, requestId);
  if (!r) return error(404, 'Request not found');
  if (r.owner_id !== me.id) return error(403, 'Only the listing owner decides requests');
  if (r.status !== 'pending') return error(409, `That request is already ${r.status}`);

  if (next === 'declined') {
    await context.env.DB.prepare(
      `UPDATE contributor_requests
          SET status = 'declined', decided_at = datetime('now'), decided_by = ?
        WHERE id = ?`
    )
      .bind(me.id, requestId)
      .run();
    await notify(context, {
      recipientId: r.requester_id,
      actorId: me.id,
      type: 'contributor_decided',
      subjectType: 'listing',
      subjectId: listingId,
      preview: 'declined',
    });
    return json({ ok: true, status: 'declined' });
  }

  await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE contributor_requests
          SET status = 'accepted', decided_at = datetime('now'), decided_by = ?
        WHERE id = ?`
    ).bind(me.id, requestId),
    context.env.DB.prepare(
      `INSERT INTO project_collaborators (project_id, user_id, role)
       VALUES (?, ?, 'viewer')
       ON CONFLICT(project_id, user_id) DO NOTHING`
    ).bind(r.project_id, r.requester_id),
  ]);
  await notify(context, {
    recipientId: r.requester_id,
    actorId: me.id,
    type: 'contributor_decided',
    subjectType: 'listing',
    subjectId: listingId,
    preview: 'accepted',
  });
  return json({ ok: true, status: 'accepted' });
}

// DELETE /api/board/:listingId/requests/:requestId — the requester withdraws.
export async function onRequestDelete(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');
  const { listingId, requestId } = context.params;

  const r = await loadRequest(context.env, listingId, requestId);
  if (!r) return error(404, 'Request not found');
  if (r.requester_id !== me.id) return error(403, 'Not allowed');
  if (r.status === 'accepted') return error(409, 'That request was already accepted');

  await context.env.DB.prepare(
    `UPDATE contributor_requests
        SET status = 'withdrawn', decided_at = datetime('now') WHERE id = ?`
  )
    .bind(requestId)
    .run();
  return json({ ok: true, status: 'withdrawn' });
}
