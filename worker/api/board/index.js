import { json, error, readJson } from '../lib/http.js';
import { uuid } from '../lib/id.js';
import { projectRole } from '../lib/projects.js';
import { trimOrNull } from '../lib/validate.js';
import {
  CARD_COLUMNS,
  HEADLINE_MAX,
  HELP_WANTED_MAX,
  activeListingCap,
  fetchUpcomingSteps,
  requireBoardOk,
  shapeOwner,
} from '../lib/board.js';

const PAGE = 20;

// GET /api/board — open listings, newest-active first, as card bundles.
// ?cursor=<offset>. Listings whose owner is disabled, or blocked either way
// relative to the caller, are hidden.
export async function onRequestGet(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');

  const offset = Math.max(
    0,
    parseInt(new URL(context.request.url).searchParams.get('cursor') || '0', 10) || 0
  );

  const { results } = await context.env.DB.prepare(
    `SELECT ${CARD_COLUMNS}
       FROM project_listings l
       JOIN projects p ON p.id = l.project_id
       JOIN users u ON u.id = p.owner_id
      WHERE l.status = 'open' AND u.disabled_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM user_blocks b
              WHERE (b.blocker_id = ?1 AND b.blocked_id = u.id)
                 OR (b.blocked_id = ?1 AND b.blocker_id = u.id))
      ORDER BY l.updated_at DESC
      LIMIT ?2 OFFSET ?3`
  )
    .bind(me.id, PAGE + 1, offset)
    .all();

  const hasMore = results.length > PAGE;
  const page = results.slice(0, PAGE);
  const upcoming = await fetchUpcomingSteps(
    context.env,
    page.map((r) => r.project_id)
  );

  const listings = page.map((r) => ({
    id: r.id,
    headline: r.headline,
    help_wanted: r.help_wanted,
    status: r.status,
    listed_at: r.listed_at,
    project_id: r.project_id,
    project_title: r.project_title,
    project_created_at: r.project_created_at,
    step_count: r.step_count,
    step_done: r.step_done,
    upcoming_steps: upcoming.get(r.project_id) || [],
    owner: shapeOwner(r),
  }));

  return json({ listings, next_cursor: hasMore ? String(offset + PAGE) : null });
}

// POST /api/board — { projectId, headline, help_wanted }. Owner only.
export async function onRequestPost(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');
  const gate = requireBoardOk(me);
  if (gate.fail) return gate.fail;

  const body = await readJson(context.request);
  const projectId = body && typeof body.projectId === 'string' ? body.projectId : null;
  const headline = trimOrNull(body && body.headline, HEADLINE_MAX);
  const helpWanted = trimOrNull(body && body.help_wanted, HELP_WANTED_MAX);
  if (!projectId) return error(400, 'projectId is required');
  if (!headline) return error(400, 'A headline is required');
  if (!helpWanted) return error(400, 'Describe what you need help with');

  const role = await projectRole(context.env, projectId, me.id);
  if (role !== 'owner') return error(403, 'Only the project owner can list it on the board');

  const existing = await context.env.DB.prepare(
    'SELECT id FROM project_listings WHERE project_id = ?'
  )
    .bind(projectId)
    .first();
  if (existing) return error(409, 'This project is already on the board');

  const openCount = await context.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM project_listings
      WHERE created_by = ? AND status = 'open'`
  )
    .bind(me.id)
    .first();
  const cap = activeListingCap(me);
  if ((openCount.n || 0) >= cap) {
    return error(
      403,
      cap === 1
        ? 'Free accounts can have one active listing. Close it first, or become a Supporter for up to three.'
        : `You already have ${cap} active listings.`
    );
  }

  const id = uuid();
  await context.env.DB.prepare(
    `INSERT INTO project_listings (id, project_id, created_by, headline, help_wanted)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(id, projectId, me.id, headline, helpWanted)
    .run();

  const listing = await context.env.DB.prepare(
    'SELECT * FROM project_listings WHERE id = ?'
  )
    .bind(id)
    .first();
  return json({ listing }, { status: 201 });
}
