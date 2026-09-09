import { json, error } from './lib/http.js';

// GET /api/tasks?scope=mine — open leaf steps assigned to the caller, across
// every project they collaborate on. Powers the Home "My tasks" view.
// (`scope` is accepted for forward-compatibility; `mine` is the only value.)
export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user) return error(401, 'Not signed in');

  const NOT_CONTAINER =
    's.id NOT IN (SELECT parent_step_id FROM project_steps WHERE parent_step_id IS NOT NULL)';

  const { results } = await context.env.DB.prepare(
    `SELECT s.id, s.title, s.due_date, s.estimate_minutes, s.parent_step_id,
            s.project_id, p.title AS project_title
       FROM project_steps s
       JOIN projects p ON p.id = s.project_id
       JOIN project_collaborators pc ON pc.project_id = p.id AND pc.user_id = ?1
      WHERE s.assignee_id = ?1
        AND s.completed = 0
        AND ${NOT_CONTAINER}
        AND p.archived_at IS NULL
        AND p.status IN ('Active', 'Waiting For')
      ORDER BY (s.due_date IS NULL), s.due_date, s.estimate_minutes`
  )
    .bind(user.id)
    .all();

  return json({ tasks: results });
}
