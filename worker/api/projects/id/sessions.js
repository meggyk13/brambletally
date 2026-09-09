import { json, error, readJson } from '../../lib/http.js';
import { requireProject } from '../../lib/projects.js';
import { uuid } from '../../lib/id.js';
import { trimOrNull } from '../../lib/validate.js';
import {
  NOTE_MAX,
  toSqlDatetime,
  shapeSession,
  SESSION_SELECT,
  SESSION_JOINS,
} from '../../lib/worksessions.js';

// GET /api/projects/:id/sessions — every collaborator's planned focus time for
// this project, upcoming first (past sessions kept for a short tail so a
// just-finished one is still visible). Viewer+.
export async function onRequestGet(context) {
  const { id } = context.params;
  const g = await requireProject(context, id, 'viewer');
  if (g.fail) return g.fail;

  const { results } = await context.env.DB.prepare(
    `SELECT ${SESSION_SELECT}
       FROM work_sessions ws ${SESSION_JOINS}
      WHERE ws.project_id = ?
        AND ws.ends_at > datetime('now', '-1 day')
      ORDER BY ws.starts_at`
  )
    .bind(id)
    .all();

  return json({ sessions: (results || []).map((r) => shapeSession(r, g.user.id)) });
}

// POST /api/projects/:id/sessions — { startsAt, endsAt, stepId?, note? }.
// Editor+. The session belongs to the caller.
export async function onRequestPost(context) {
  const { id } = context.params;
  const g = await requireProject(context, id, 'editor');
  if (g.fail) return g.fail;

  const body = await readJson(context.request);
  const startsAt = toSqlDatetime(body && body.startsAt);
  const endsAt = toSqlDatetime(body && body.endsAt);
  if (!startsAt || !endsAt) return error(400, 'A start and end time are required');
  if (endsAt <= startsAt) return error(400, 'The end time must be after the start');

  const note = trimOrNull(body && body.note, NOTE_MAX);
  let stepId = body && typeof body.stepId === 'string' ? body.stepId : null;
  if (stepId) {
    const step = await context.env.DB.prepare(
      'SELECT id FROM project_steps WHERE id = ? AND project_id = ?'
    )
      .bind(stepId, id)
      .first();
    if (!step) return error(400, 'That step is not on this project');
  }

  const sessionId = uuid();
  await context.env.DB.prepare(
    `INSERT INTO work_sessions (id, user_id, project_id, step_id, starts_at, ends_at, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(sessionId, g.user.id, id, stepId, startsAt, endsAt, note)
    .run();

  const row = await context.env.DB.prepare(
    `SELECT ${SESSION_SELECT} FROM work_sessions ws ${SESSION_JOINS} WHERE ws.id = ?`
  )
    .bind(sessionId)
    .first();
  return json({ session: shapeSession(row, g.user.id) }, { status: 201 });
}
