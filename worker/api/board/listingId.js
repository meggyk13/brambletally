import { json, error, readJson } from '../lib/http.js';
import { projectRole } from '../lib/projects.js';
import { blockedBetween } from '../lib/blocks.js';
import { trimOrNull } from '../lib/validate.js';
import {
  CARD_COLUMNS,
  HEADLINE_MAX,
  HELP_WANTED_MAX,
  LISTING_STATUSES,
  fetchUpcomingSteps,
  shapeOwner,
  shapeComment,
} from '../lib/board.js';

// GET /api/board/:listingId — card bundle + comments + the caller's own request
// state (+ pending requests when the caller owns it).
export async function onRequestGet(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');
  const { listingId } = context.params;

  const row = await context.env.DB.prepare(
    `SELECT ${CARD_COLUMNS}
       FROM project_listings l
       JOIN projects p ON p.id = l.project_id
       JOIN users u ON u.id = p.owner_id
      WHERE l.id = ?`
  )
    .bind(listingId)
    .first();
  if (!row) return error(404, 'Listing not found');

  const isOwner = row.owner_id === me.id;
  if (row.owner_disabled_at && !isOwner) return error(404, 'Listing not found');
  if (!isOwner && (await blockedBetween(context.env, me.id, row.owner_id)))
    return error(404, 'Listing not found');

  const [{ results: commentRows }, myRole, myRequest, upcoming] = await Promise.all([
    context.env.DB.prepare(
      `SELECT c.*, u.handle AS a_handle, u.display_name AS a_display_name,
              u.name AS a_name, u.plan AS a_plan
         FROM listing_comments c JOIN users u ON u.id = c.user_id
        WHERE c.listing_id = ?
        ORDER BY c.created_at`
    )
      .bind(listingId)
      .all(),
    projectRole(context.env, row.project_id, me.id),
    context.env.DB.prepare(
      `SELECT id, status, message, created_at, decided_at
         FROM contributor_requests WHERE listing_id = ? AND requester_id = ?`
    )
      .bind(listingId, me.id)
      .first(),
    fetchUpcomingSteps(context.env, [row.project_id]),
  ]);

  // One-level threading: top-level comments with their replies nested.
  const shaped = (commentRows || []).map((c) => ({
    ...shapeComment(c, me.id),
    can_delete: isOwner || context.data.user.is_admin || c.user_id === me.id,
  }));
  const byId = new Map(shaped.map((c) => [c.id, { ...c, replies: [] }]));
  const top = [];
  for (const c of byId.values()) {
    if (c.parent_comment_id && byId.has(c.parent_comment_id)) {
      byId.get(c.parent_comment_id).replies.push(c);
    } else if (!c.parent_comment_id) {
      top.push(c);
    }
  }

  let requests = null;
  if (isOwner) {
    const { results } = await context.env.DB.prepare(
      `SELECT r.id, r.message, r.status, r.created_at,
              u.handle, u.display_name, u.name, u.plan
         FROM contributor_requests r JOIN users u ON u.id = r.requester_id
        WHERE r.listing_id = ? AND r.status = 'pending'
        ORDER BY r.created_at`
    )
      .bind(listingId)
      .all();
    requests = (results || []).map((r) => ({
      id: r.id,
      message: r.message,
      created_at: r.created_at,
      requester: {
        handle: r.handle,
        display_name: r.display_name,
        name: r.name,
        supporter: r.plan === 'supporter',
      },
    }));
  }

  return json({
    listing: {
      id: row.id,
      headline: row.headline,
      help_wanted: row.help_wanted,
      status: row.status,
      listed_at: row.listed_at,
      project_id: row.project_id,
      project_title: row.project_title,
      project_created_at: row.project_created_at,
      step_count: row.step_count,
      step_done: row.step_done,
      upcoming_steps: upcoming.get(row.project_id) || [],
      owner: shapeOwner(row),
    },
    comments: top,
    my_role: myRole, // null | 'viewer' | 'editor' | 'owner'
    my_request: myRequest || null,
    is_owner: isOwner,
    is_admin: !!context.data.user.is_admin,
    requests,
  });
}

// PATCH /api/board/:listingId — { headline?, help_wanted?, status? }. Owner or admin.
export async function onRequestPatch(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');
  const { listingId } = context.params;

  const listing = await context.env.DB.prepare(
    `SELECT l.id, l.project_id, p.owner_id FROM project_listings l
       JOIN projects p ON p.id = l.project_id WHERE l.id = ?`
  )
    .bind(listingId)
    .first();
  if (!listing) return error(404, 'Listing not found');
  if (listing.owner_id !== me.id && !me.is_admin) return error(403, 'Not allowed');

  const body = await readJson(context.request);
  if (!body) return error(400, 'Body required');
  const fields = {};
  if ('headline' in body) {
    const v = trimOrNull(body.headline, HEADLINE_MAX);
    if (!v) return error(400, 'A headline is required');
    fields.headline = v;
  }
  if ('help_wanted' in body) {
    const v = trimOrNull(body.help_wanted, HELP_WANTED_MAX);
    if (!v) return error(400, 'The help-wanted text is required');
    fields.help_wanted = v;
  }
  if ('status' in body) {
    if (!LISTING_STATUSES.includes(body.status)) return error(400, 'Bad status');
    fields.status = body.status;
  }
  if (Object.keys(fields).length === 0) return error(400, 'Nothing to update');

  const cols = Object.keys(fields);
  await context.env.DB.prepare(
    `UPDATE project_listings SET ${cols.map((c) => `${c} = ?`).join(', ')},
       updated_at = datetime('now') WHERE id = ?`
  )
    .bind(...cols.map((c) => fields[c]), listingId)
    .run();

  const updated = await context.env.DB.prepare('SELECT * FROM project_listings WHERE id = ?')
    .bind(listingId)
    .first();
  return json({ listing: updated });
}

// DELETE /api/board/:listingId — owner or admin. Comments + requests cascade.
export async function onRequestDelete(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');
  const { listingId } = context.params;

  const listing = await context.env.DB.prepare(
    `SELECT l.id, p.owner_id FROM project_listings l
       JOIN projects p ON p.id = l.project_id WHERE l.id = ?`
  )
    .bind(listingId)
    .first();
  if (!listing) return error(404, 'Listing not found');
  if (listing.owner_id !== me.id && !me.is_admin) return error(403, 'Not allowed');

  await context.env.DB.prepare('DELETE FROM project_listings WHERE id = ?')
    .bind(listingId)
    .run();
  return json({ ok: true });
}
