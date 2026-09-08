import { json, error, readJson } from '../../lib/http.js';
import { uuid } from '../../lib/id.js';
import { projectRole } from '../../lib/projects.js';
import { blockedBetween } from '../../lib/blocks.js';
import { trimOrNull } from '../../lib/validate.js';
import { REQUEST_MSG_MAX, REQUEST_DAILY_CAP, loadListing, requireBoardOk } from '../../lib/board.js';

// POST /api/board/:listingId/requests — { message? }. Ask to contribute.
// Reuses a prior declined/withdrawn row (back to 'pending'); a live pending or
// an accepted row is a 409. Soft daily cap across all listings.
export async function onRequestPost(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');
  const gate = requireBoardOk(me);
  if (gate.fail) return gate.fail;

  const { listingId } = context.params;
  const listing = await loadListing(context.env, listingId);
  if (!listing) return error(404, 'Listing not found');
  if (listing.owner_id === me.id) return error(400, "It's your own listing");
  if (listing.status !== 'open') return error(409, 'This listing isn’t taking requests');
  if (await blockedBetween(context.env, me.id, listing.owner_id))
    return error(404, 'Listing not found');

  const role = await projectRole(context.env, listing.project_id, me.id);
  if (role) return error(409, 'You already have access to this project');

  const body = await readJson(context.request);
  const message = trimOrNull(body && body.message, REQUEST_MSG_MAX);

  const existing = await context.env.DB.prepare(
    'SELECT id, status FROM contributor_requests WHERE listing_id = ? AND requester_id = ?'
  )
    .bind(listingId, me.id)
    .first();
  if (existing && existing.status === 'pending')
    return error(409, 'Your request is already pending');
  if (existing && existing.status === 'accepted')
    return error(409, 'Your request was already accepted');

  const recent = await context.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM contributor_requests
      WHERE requester_id = ? AND created_at > datetime('now', '-1 day')`
  )
    .bind(me.id)
    .first();
  if ((recent.n || 0) >= REQUEST_DAILY_CAP)
    return error(429, 'You’ve sent a lot of requests today. Try again tomorrow.');

  let id;
  if (existing) {
    id = existing.id;
    await context.env.DB.prepare(
      `UPDATE contributor_requests
          SET status = 'pending', message = ?, created_at = datetime('now'),
              decided_at = NULL, decided_by = NULL
        WHERE id = ?`
    )
      .bind(message, id)
      .run();
  } else {
    id = uuid();
    await context.env.DB.prepare(
      `INSERT INTO contributor_requests (id, listing_id, requester_id, message)
       VALUES (?, ?, ?, ?)`
    )
      .bind(id, listingId, me.id, message)
      .run();
  }

  const row = await context.env.DB.prepare(
    'SELECT id, status, message, created_at FROM contributor_requests WHERE id = ?'
  )
    .bind(id)
    .first();
  return json({ request: row }, { status: 201 });
}
