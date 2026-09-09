import { json, error } from '../lib/http.js';
import { isSupporter } from '../lib/plan.js';

const PAGE = 20;
const PREVIEW_MAX = 160;

// Block check as a ?1-bound fragment (the caller's id is ?1 everywhere in this
// query). `notBlockedSql` in lib/blocks.js uses bare `?`, which doesn't compose
// with the UNION below — so it's spelled out here.
const notBlocked = (userCol) =>
  `NOT EXISTS (SELECT 1 FROM user_blocks b
     WHERE (b.blocker_id = ?1 AND b.blocked_id = ${userCol})
        OR (b.blocked_id = ?1 AND b.blocker_id = ${userCol}))`;

// GET /api/feed?filter=all|following&cursor=<offset>
//
// Reverse-chron board activity, derived at read time from project_listings and
// listing_comments. Never touches private project activity. Excludes the
// caller's own events, disabled actors, and anything blocked either direction.
// Each event carries `from_followed` so the client can mark people you follow;
// ?filter=following narrows to just those.
export async function onRequestGet(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');

  const url = new URL(context.request.url);
  const following = url.searchParams.get('filter') === 'following';
  const offset = Math.max(0, parseInt(url.searchParams.get('cursor') || '0', 10) || 0);

  const followedOnly = following
    ? 'AND actor_id IN (SELECT followee_id FROM follows WHERE follower_id = ?1)'
    : '';

  const { results } = await context.env.DB.prepare(
    `SELECT *,
            (actor_id IN (SELECT followee_id FROM follows WHERE follower_id = ?1)) AS from_followed
       FROM (
         SELECT 'listing' AS kind,
                l.id AS listing_id,
                l.created_at AS created_at,
                l.created_by AS actor_id,
                l.headline AS preview,
                p.id AS project_id,
                p.title AS project_title,
                u.handle AS actor_handle,
                u.display_name AS actor_display_name,
                u.name AS actor_name,
                u.plan AS actor_plan
           FROM project_listings l
           JOIN projects p ON p.id = l.project_id
           JOIN users u ON u.id = l.created_by
          WHERE l.status = 'open'
            AND u.disabled_at IS NULL
            AND l.created_by != ?1
            AND ${notBlocked('l.created_by')}

         UNION ALL

         SELECT 'comment' AS kind,
                c.listing_id AS listing_id,
                c.created_at AS created_at,
                c.user_id AS actor_id,
                substr(c.body, 1, ${PREVIEW_MAX}) AS preview,
                p.id AS project_id,
                p.title AS project_title,
                u.handle AS actor_handle,
                u.display_name AS actor_display_name,
                u.name AS actor_name,
                u.plan AS actor_plan
           FROM listing_comments c
           JOIN project_listings l ON l.id = c.listing_id
           JOIN projects p ON p.id = l.project_id
           JOIN users u ON u.id = c.user_id
          WHERE c.deleted_at IS NULL
            AND l.status = 'open'
            AND u.disabled_at IS NULL
            AND c.user_id != ?1
            AND ${notBlocked('c.user_id')}
       )
      WHERE 1 = 1 ${followedOnly}
      ORDER BY created_at DESC
      LIMIT ?2 OFFSET ?3`
  )
    .bind(me.id, PAGE + 1, offset)
    .all();

  const hasMore = results.length > PAGE;
  const events = results.slice(0, PAGE).map((r) => ({
    kind: r.kind,
    listing_id: r.listing_id,
    project_id: r.project_id,
    project_title: r.project_title,
    preview: r.preview,
    created_at: r.created_at,
    from_followed: !!r.from_followed,
    actor: {
      handle: r.actor_handle,
      display_name: r.actor_display_name,
      name: r.actor_name,
      supporter: isSupporter({ plan: r.actor_plan }),
    },
  }));

  return json({ events, next_cursor: hasMore ? String(offset + PAGE) : null });
}
