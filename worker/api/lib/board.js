import { error } from './http.js';
import { isSupporter } from './plan.js';

export const HEADLINE_MAX = 120;
export const HELP_WANTED_MAX = 2000;
export const COMMENT_MAX = 2000;
export const REQUEST_MSG_MAX = 1000;
export const REQUEST_DAILY_CAP = 10; // contributor requests per user per rolling 24h
export const REPORT_DAILY_CAP = 10; // reports per user per rolling 24h
export const LISTING_STATUSES = ['open', 'closed', 'archived'];

// A Turnstile challenge guards a caller's first few board writes (requests +
// reports). Below this many lifetime board actions, a token is required.
export const TURNSTILE_UNTIL_ACTIONS = 3;

// Lifetime board-action count for `me` — requests sent + comments posted +
// reports filed. Drives the "board_new" flag on /api/auth/me.
export async function boardActionCount(env, userId) {
  const row = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM contributor_requests WHERE requester_id = ?1) +
       (SELECT COUNT(*) FROM listing_comments WHERE user_id = ?1) +
       (SELECT COUNT(*) FROM reports WHERE reporter_id = ?1) AS n`
  )
    .bind(userId)
    .first();
  return (row && row.n) || 0;
}

// Active-listing cap: the one supporter gate on the board.
export const activeListingCap = (user) => (isSupporter(user) ? 3 : 1);

// Leaf-only step predicate (mirrors worker/api/projects/index.js). A step with
// sub-steps is a derived container and isn't tallied.
export const NOT_CONTAINER =
  's.id NOT IN (SELECT parent_step_id FROM project_steps WHERE parent_step_id IS NOT NULL)';

// Soft board sanction: users.board_blocked_at set -> can't create listings,
// comment, or send contributor requests. Reads and reports are unaffected.
export function requireBoardOk(user) {
  if (user && user.board_blocked_at) {
    return {
      fail: error(403, 'Your access to the board is restricted. See the acceptable-use policy.'),
    };
  }
  return { ok: true };
}

// The card-bundle columns shared by GET /api/board and the listing detail.
// Expects the query to alias project_listings AS l, projects AS p, users AS u
// (the project owner).
export const CARD_COLUMNS = `
  l.id, l.headline, l.help_wanted, l.status, l.created_at AS listed_at, l.updated_at,
  p.id AS project_id, p.title AS project_title, p.created_at AS project_created_at,
  (SELECT COUNT(*) FROM project_steps s
     WHERE s.project_id = p.id AND ${NOT_CONTAINER}) AS step_count,
  (SELECT COUNT(*) FROM project_steps s
     WHERE s.project_id = p.id AND s.completed = 1 AND ${NOT_CONTAINER}) AS step_done,
  u.id AS owner_id, u.handle AS owner_handle, u.display_name AS owner_display_name,
  u.name AS owner_name, u.plan AS owner_plan, u.disabled_at AS owner_disabled_at`;

export const shapeOwner = (row) => ({
  handle: row.owner_handle,
  display_name: row.owner_display_name,
  name: row.owner_name,
  supporter: isSupporter({ plan: row.owner_plan }),
});

// Up to 3 open leaf steps per project, by due date (nulls last) then created.
// Returns Map<project_id, [{ title, due_date }]>.
export async function fetchUpcomingSteps(env, projectIds) {
  const map = new Map();
  if (!projectIds.length) return map;
  const ph = projectIds.map(() => '?').join(',');
  const { results } = await env.DB.prepare(
    `SELECT project_id, title, due_date FROM (
       SELECT s.project_id, s.title, s.due_date,
              ROW_NUMBER() OVER (
                PARTITION BY s.project_id
                ORDER BY (s.due_date IS NULL), s.due_date, s.created_at
              ) AS rn
         FROM project_steps s
        WHERE s.project_id IN (${ph}) AND s.completed = 0 AND ${NOT_CONTAINER}
     ) WHERE rn <= 3`
  )
    .bind(...projectIds)
    .all();
  for (const r of results || []) {
    if (!map.has(r.project_id)) map.set(r.project_id, []);
    map.get(r.project_id).push({ title: r.title, due_date: r.due_date });
  }
  return map;
}

// Minimal listing load for the write routes: id, project, status, and the
// project owner. Null if the listing doesn't exist.
export function loadListing(env, listingId) {
  return env.DB.prepare(
    `SELECT l.id, l.project_id, l.status, l.created_by, p.owner_id
       FROM project_listings l JOIN projects p ON p.id = l.project_id
      WHERE l.id = ?`
  )
    .bind(listingId)
    .first();
}

// Shape a comment row (its author columns aliased a_*) for the client.
export const shapeComment = (row, meId) => ({
  id: row.id,
  parent_comment_id: row.parent_comment_id,
  body: row.deleted_at ? null : row.body,
  deleted: !!row.deleted_at,
  created_at: row.created_at,
  edited_at: row.edited_at,
  author: row.deleted_at
    ? null
    : {
        handle: row.a_handle,
        display_name: row.a_display_name,
        name: row.a_name,
        supporter: isSupporter({ plan: row.a_plan }),
      },
  is_mine: row.user_id === meId,
});
