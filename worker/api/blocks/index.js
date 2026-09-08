import { json, error, readJson } from '../lib/http.js';

// GET /api/blocks — the caller's own block list, for Settings.
export async function onRequestGet(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');

  const { results } = await context.env.DB.prepare(
    `SELECT u.handle, u.display_name, u.name, b.created_at
       FROM user_blocks b
       JOIN users u ON u.id = b.blocked_id
      WHERE b.blocker_id = ?
      ORDER BY b.created_at DESC`
  )
    .bind(me.id)
    .all();

  return json({ blocks: results || [] });
}

// POST /api/blocks — body { handle }. Idempotent. Also drops any follow in
// either direction between the two accounts.
export async function onRequestPost(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');

  const body = await readJson(context.request);
  let handle = String((body && body.handle) || '').trim().toLowerCase();
  if (handle.startsWith('@')) handle = handle.slice(1);
  if (!handle) return error(400, 'A handle is required');

  const target = await context.env.DB.prepare(
    'SELECT id FROM users WHERE handle = ?'
  )
    .bind(handle)
    .first();
  if (!target) return error(404, 'No such account');
  if (target.id === me.id) return error(400, "You can't block yourself");

  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT INTO user_blocks (blocker_id, blocked_id) VALUES (?, ?)
       ON CONFLICT(blocker_id, blocked_id) DO NOTHING`
    ).bind(me.id, target.id),
    context.env.DB.prepare(
      `DELETE FROM follows
        WHERE (follower_id = ?1 AND followee_id = ?2)
           OR (follower_id = ?2 AND followee_id = ?1)`
    ).bind(me.id, target.id),
  ]);

  return json({ ok: true, handle });
}
