import { json, error } from '../lib/http.js';

// DELETE /api/blocks/:handle — unblock. Idempotent (200 even if not blocked).
export async function onRequestDelete(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');

  let handle = String(context.params.handle || '').trim().toLowerCase();
  if (handle.startsWith('@')) handle = handle.slice(1);
  if (!handle) return error(400, 'A handle is required');

  const target = await context.env.DB.prepare('SELECT id FROM users WHERE handle = ?')
    .bind(handle)
    .first();
  if (!target) return error(404, 'No such account');

  await context.env.DB.prepare(
    'DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?'
  )
    .bind(me.id, target.id)
    .run();

  return json({ ok: true, handle });
}
