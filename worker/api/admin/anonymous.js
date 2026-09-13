import { json } from '../lib/http.js';
import { requireAdmin } from '../lib/admin.js';

const PAGE = 50;

// GET /api/admin/anonymous?cursor=&q= — unclaimed accounts (docs/plan.md part
// E): every `users` row with email IS NULL, newest first, with their project
// title(s) so drop-off is eyeballable. Paginated — this is the one admin list
// with no moderation action gating its growth (anyone can drop off without
// signing up), so it's the likeliest to actually need it. `q` matches a
// project title.
export async function onRequestGet(context) {
  const g = requireAdmin(context);
  if (g.fail) return g.fail;

  const params = new URL(context.request.url).searchParams;
  const offset = Math.max(0, parseInt(params.get('cursor') || '0', 10) || 0);
  const q = (params.get('q') || '').trim().toLowerCase();

  const conds = ['u.email IS NULL'];
  const binds = [];
  if (q) {
    conds.push(
      `EXISTS (SELECT 1 FROM projects p2 WHERE p2.owner_id = u.id AND lower(p2.title) LIKE ?)`
    );
    binds.push(`%${q}%`);
  }

  const { results } = await context.env.DB.prepare(
    `SELECT u.id, u.created_at,
            (SELECT GROUP_CONCAT(p.title, ', ') FROM projects p WHERE p.owner_id = u.id) AS project_titles
       FROM users u
      WHERE ${conds.join(' AND ')}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?`
  )
    .bind(...binds, PAGE + 1, offset)
    .all();

  const hasMore = results.length > PAGE;
  const users = results.slice(0, PAGE);

  return json({ users, next_cursor: hasMore ? String(offset + PAGE) : null });
}
