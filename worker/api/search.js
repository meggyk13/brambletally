import { json, error } from './lib/http.js';

// GET /api/search?q=… — projects, steps and inbox items the user can see.
export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user) return error(401, 'Not signed in');

  let q = (new URL(context.request.url).searchParams.get('q') || '').trim().toLowerCase();
  if (q.length < 2) return json({ projects: [], steps: [], inbox: [], people: [] });
  const like = `%${q}%`;
  const db = context.env.DB;
  // A leading "@" scopes the search to people.
  const handleLike = `%${q.startsWith('@') ? q.slice(1) : q}%`;

  // ?1 = user id, ?2 = LIKE pattern
  // Leaf-only, matching the home list: a step with sub-steps is a derived
  // container and isn't counted itself.
  const notContainer =
    's.id NOT IN (SELECT parent_step_id FROM project_steps WHERE parent_step_id IS NOT NULL)';
  const projects = (await db.prepare(
    `SELECT p.id, p.title, p.category, p.status, p.deadline, pc.role,
            (SELECT COUNT(*) FROM project_steps s
              WHERE s.project_id = p.id AND ${notContainer}) AS step_count,
            (SELECT COUNT(*) FROM project_steps s
              WHERE s.project_id = p.id AND s.completed = 1 AND ${notContainer}) AS step_done
       FROM projects p
       JOIN project_collaborators pc ON pc.project_id = p.id AND pc.user_id = ?1
      WHERE lower(p.title) LIKE ?2
         OR lower(COALESCE(p.description, '')) LIKE ?2
         OR lower(COALESCE(p.pickup_note, '')) LIKE ?2
         OR lower(COALESCE(p.category, '')) LIKE ?2
      ORDER BY p.updated_at DESC
      LIMIT 25`
  )
    .bind(user.id, like)
    .all()).results;

  const steps = (await db.prepare(
    `SELECT s.id, s.title, s.completed, s.due_date, s.project_id, s.parent_step_id,
            s.estimate_minutes, p.title AS project_title, parent.title AS parent_title
       FROM project_steps s
       JOIN projects p ON p.id = s.project_id
       LEFT JOIN project_steps parent ON parent.id = s.parent_step_id
       JOIN project_collaborators pc ON pc.project_id = p.id AND pc.user_id = ?1
      WHERE lower(s.title) LIKE ?2 OR lower(COALESCE(s.notes, '')) LIKE ?2
      ORDER BY s.completed, s.created_at DESC
      LIMIT 40`
  )
    .bind(user.id, like)
    .all()).results;

  const inbox = (await db.prepare(
    'SELECT id, text, created_at FROM inbox_items WHERE user_id = ?1 AND lower(text) LIKE ?2 LIMIT 20'
  )
    .bind(user.id, like)
    .all()).results;

  // People: signed-in accounts with a handle, matched on handle / display_name /
  // legacy name. Self, disabled and blocked (either direction) accounts
  // excluded. Never returns email.
  const people = (await db.prepare(
    `SELECT handle, display_name, name FROM users
      WHERE id != ?1 AND handle IS NOT NULL AND disabled_at IS NULL
        AND (handle LIKE ?2 OR lower(COALESCE(display_name, '')) LIKE ?3
             OR lower(COALESCE(name, '')) LIKE ?3)
        AND NOT EXISTS (SELECT 1 FROM user_blocks b
              WHERE (b.blocker_id = ?1 AND b.blocked_id = users.id)
                 OR (b.blocked_id = ?1 AND b.blocker_id = users.id))
      ORDER BY COALESCE(display_name, name, handle) COLLATE NOCASE
      LIMIT 10`
  )
    .bind(user.id, handleLike, like)
    .all()).results;

  return json({ projects, steps, inbox, people });
}
