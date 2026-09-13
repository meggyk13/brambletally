import { json, error, readJson } from '../lib/http.js';
import { uuid } from '../lib/id.js';
import { requireProject, touchStmt } from '../lib/projects.js';

// POST /api/shuffle/promote-step { project_id, step_id } — Shuffle's "→ New
// project" action on a project_next_step_no_note card. Spins a single
// top-level, childless step out into its own standalone project (title =
// step title, description = the step's notes if any) and removes the step
// from its source project. No shuffle_state bookkeeping needed — the step is
// gone, so the box's own candidate query stops matching on its own.
export async function onRequestPost(context) {
  const body = await readJson(context.request);
  if (!body || typeof body.project_id !== 'string' || typeof body.step_id !== 'string') {
    return error(400, 'project_id and step_id required');
  }

  const g = await requireProject(context, body.project_id, 'editor');
  if (g.fail) return g.fail;

  const step = await context.env.DB.prepare(
    'SELECT * FROM project_steps WHERE id = ? AND project_id = ?'
  )
    .bind(body.step_id, body.project_id)
    .first();
  if (!step) return error(404, 'Step not found');
  if (step.parent_step_id) return error(400, 'Only a top-level step can become a project');
  const isContainer = await context.env.DB.prepare(
    'SELECT 1 FROM project_steps WHERE parent_step_id = ? LIMIT 1'
  )
    .bind(step.id)
    .first();
  if (isContainer) return error(400, "A step with sub-steps can't become a project");

  const newId = uuid();
  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT INTO projects (id, owner_id, title, description, status)
       VALUES (?, ?, ?, ?, 'Active')`
    ).bind(newId, g.user.id, step.title, step.notes ?? null),
    context.env.DB.prepare(
      "INSERT INTO project_collaborators (project_id, user_id, role) VALUES (?, ?, 'owner')"
    ).bind(newId, g.user.id),
    context.env.DB.prepare('DELETE FROM project_steps WHERE id = ?').bind(step.id),
    touchStmt(context.env, body.project_id),
  ]);

  const project = await context.env.DB.prepare('SELECT * FROM projects WHERE id = ?')
    .bind(newId)
    .first();

  return json({ project: { ...project, role: 'owner' } }, { status: 201 });
}
