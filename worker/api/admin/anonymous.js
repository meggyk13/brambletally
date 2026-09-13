import { json } from '../lib/http.js';
import { requireAdmin } from '../lib/admin.js';

// GET /api/admin/anonymous — unclaimed accounts (docs/plan.md part E): every
// `users` row with email IS NULL, newest first, with their project title(s)
// so drop-off is eyeballable. No purge job — deferred per 2026-09-12 decision.
export async function onRequestGet(context) {
  const g = requireAdmin(context);
  if (g.fail) return g.fail;

  const { results } = await context.env.DB.prepare(
    `SELECT u.id, u.created_at,
            (SELECT GROUP_CONCAT(p.title, ', ') FROM projects p WHERE p.owner_id = u.id) AS project_titles
       FROM users u
      WHERE u.email IS NULL
      ORDER BY u.created_at DESC`
  ).all();

  return json({ users: results });
}
