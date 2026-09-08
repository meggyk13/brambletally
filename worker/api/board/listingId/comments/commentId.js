import { json, error, readJson } from '../../../lib/http.js';
import { trimOrNull } from '../../../lib/validate.js';
import { COMMENT_MAX } from '../../../lib/board.js';

async function loadComment(env, listingId, commentId) {
  return env.DB.prepare(
    `SELECT c.id, c.user_id, c.deleted_at, p.owner_id AS listing_owner_id
       FROM listing_comments c
       JOIN project_listings l ON l.id = c.listing_id
       JOIN projects p ON p.id = l.project_id
      WHERE c.id = ? AND c.listing_id = ?`
  )
    .bind(commentId, listingId)
    .first();
}

// PATCH /api/board/:listingId/comments/:commentId — { body }. Author only.
export async function onRequestPatch(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');
  const { listingId, commentId } = context.params;

  const c = await loadComment(context.env, listingId, commentId);
  if (!c || c.deleted_at) return error(404, 'Comment not found');
  if (c.user_id !== me.id) return error(403, 'Not allowed');

  const body = await readJson(context.request);
  const text = trimOrNull(body && body.body, COMMENT_MAX);
  if (!text) return error(400, 'Say something first');

  await context.env.DB.prepare(
    "UPDATE listing_comments SET body = ?, edited_at = datetime('now') WHERE id = ?"
  )
    .bind(text, commentId)
    .run();
  return json({ ok: true, body: text, edited_at: new Date().toISOString() });
}

// DELETE /api/board/:listingId/comments/:commentId — author, listing owner, or
// admin. Soft delete: the row stays so replies keep context.
export async function onRequestDelete(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');
  const { listingId, commentId } = context.params;

  const c = await loadComment(context.env, listingId, commentId);
  if (!c) return error(404, 'Comment not found');
  const allowed = c.user_id === me.id || c.listing_owner_id === me.id || me.is_admin;
  if (!allowed) return error(403, 'Not allowed');
  if (c.deleted_at) return json({ ok: true });

  await context.env.DB.prepare(
    "UPDATE listing_comments SET deleted_at = datetime('now') WHERE id = ?"
  )
    .bind(commentId)
    .run();
  return json({ ok: true });
}
