import { json, error } from '../lib/http.js';
import { isSupporter } from '../lib/plan.js';
import { blockedBetween } from '../lib/blocks.js';

const PAGE = 30;

// GET /api/profile/:handle/followers  and  /api/profile/:handle/following
// One module, registered at both paths — the trailing segment picks the
// direction. Signed-in only; the target's disabled/blocked state 404s it the
// same way the profile bundle does. Each listed user is itself block-filtered
// and disabled-filtered, and carries `is_following` (does the caller follow
// them) so the client can show a per-row toggle. Paged with ?cursor=<offset>.
export async function onRequestGet(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');

  const wantFollowers = new URL(context.request.url).pathname.endsWith('/followers');

  let handle = String(context.params.handle || '').trim().toLowerCase();
  if (handle.startsWith('@')) handle = handle.slice(1);
  if (!handle) return error(404, 'No such profile');

  const target = await context.env.DB.prepare(
    'SELECT id, handle, display_name, disabled_at FROM users WHERE handle = ?'
  )
    .bind(handle)
    .first();
  if (!target) return error(404, 'No such profile');
  const isSelf = target.id === me.id;
  if (target.disabled_at && !isSelf) return error(404, 'No such profile');
  if (!isSelf && (await blockedBetween(context.env, me.id, target.id)))
    return error(404, 'No such profile');

  const offset = Math.max(
    0,
    parseInt(new URL(context.request.url).searchParams.get('cursor') || '0', 10) || 0
  );

  // followers: the follower side, keyed on followee_id = target.
  // following: the followee side, keyed on follower_id = target.
  const joinCol = wantFollowers ? 'f.follower_id' : 'f.followee_id';
  const keyCol = wantFollowers ? 'f.followee_id' : 'f.follower_id';

  const { results } = await context.env.DB.prepare(
    `SELECT u.handle, u.display_name, u.name, u.plan,
            EXISTS (SELECT 1 FROM follows me2
                     WHERE me2.follower_id = ?1 AND me2.followee_id = u.id) AS is_following
       FROM follows f
       JOIN users u ON u.id = ${joinCol}
      WHERE ${keyCol} = ?2 AND u.disabled_at IS NULL AND u.handle IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM user_blocks b
              WHERE (b.blocker_id = ?3 AND b.blocked_id = u.id)
                 OR (b.blocked_id = ?4 AND b.blocker_id = u.id))
      ORDER BY COALESCE(u.display_name, u.name, u.handle) COLLATE NOCASE
      LIMIT ?5 OFFSET ?6`
  )
    .bind(me.id, target.id, me.id, me.id, PAGE + 1, offset)
    .all();

  const hasMore = results.length > PAGE;
  const users = results.slice(0, PAGE).map((u) => ({
    handle: u.handle,
    display_name: u.display_name,
    name: u.name,
    supporter: isSupporter(u),
    is_following: !!u.is_following,
  }));

  return json({
    profile: { handle: target.handle, display_name: target.display_name },
    rel: wantFollowers ? 'followers' : 'following',
    users,
    next_cursor: hasMore ? String(offset + PAGE) : null,
  });
}
