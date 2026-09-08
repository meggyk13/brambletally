import { json, error, readJson } from '../lib/http.js';
import { blockedBetween } from '../lib/blocks.js';
import { isSupporter } from '../lib/plan.js';
import { notify } from '../lib/notify.js';

// GET /api/follows — the accounts the caller follows. Used by the
// collaborator-invite picker ("people you follow") so it returns `id`, like
// /api/users/search.
export async function onRequestGet(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');

  const { results } = await context.env.DB.prepare(
    `SELECT u.id, u.handle, u.display_name, u.name, u.plan
       FROM follows f
       JOIN users u ON u.id = f.followee_id
      WHERE f.follower_id = ? AND u.disabled_at IS NULL
      ORDER BY COALESCE(u.display_name, u.name, u.handle) COLLATE NOCASE`
  )
    .bind(me.id)
    .all();

  return json({
    users: (results || []).map((u) => ({
      id: u.id,
      handle: u.handle,
      display_name: u.display_name,
      name: u.name,
      supporter: isSupporter(u),
    })),
  });
}

// POST /api/follows — body { handle }. Idempotent. No accept step. The
// "started following you" notification lands with the Phase 3 notifications
// table.
export async function onRequestPost(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');

  const body = await readJson(context.request);
  let handle = String((body && body.handle) || '').trim().toLowerCase();
  if (handle.startsWith('@')) handle = handle.slice(1);
  if (!handle) return error(400, 'A handle is required');

  const target = await context.env.DB.prepare(
    'SELECT id, disabled_at FROM users WHERE handle = ?'
  )
    .bind(handle)
    .first();
  // A disabled account, or either side of a block, is indistinguishable from
  // "no such account" here — same as the profile route.
  if (!target || target.disabled_at) return error(404, 'No such account');
  if (target.id === me.id) return error(400, "You can't follow yourself");
  if (await blockedBetween(context.env, me.id, target.id))
    return error(404, 'No such account');

  const res = await context.env.DB.prepare(
    `INSERT INTO follows (follower_id, followee_id) VALUES (?, ?)
     ON CONFLICT(follower_id, followee_id) DO NOTHING`
  )
    .bind(me.id, target.id)
    .run();

  if (res.meta.changes) {
    await notify(context, {
      recipientId: target.id,
      actorId: me.id,
      type: 'follow',
      subjectType: 'profile',
      subjectId: me.id,
    });
  }

  return json({ ok: true, following: true, handle });
}
