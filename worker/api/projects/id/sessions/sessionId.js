import { json, error, readJson } from '../../../lib/http.js';
import { requireProject } from '../../../lib/projects.js';
import { trimOrNull } from '../../../lib/validate.js';
import {
  WS_STATUSES,
  NOTE_MAX,
  toSqlDatetime,
  shapeSession,
  SESSION_SELECT,
  SESSION_JOINS,
} from '../../../lib/worksessions.js';

// Load a session scoped to its project. Returns the raw row or null.
function loadSession(env, projectId, sessionId) {
  return env.DB.prepare(
    'SELECT * FROM work_sessions WHERE id = ? AND project_id = ?'
  )
    .bind(sessionId, projectId)
    .first();
}

// PATCH /api/projects/:id/sessions/:sessionId
// { startsAt?, endsAt?, stepId?, note?, status? }. Only the planner may edit.
export async function onRequestPatch(context) {
  const { id, sessionId } = context.params;
  const g = await requireProject(context, id, 'viewer');
  if (g.fail) return g.fail;

  const row = await loadSession(context.env, id, sessionId);
  if (!row) return error(404, 'Session not found');
  if (row.user_id !== g.user.id) return error(403, 'That focus time belongs to someone else');

  const body = (await readJson(context.request)) || {};
  const set = [];
  const vals = [];

  if ('startsAt' in body || 'endsAt' in body) {
    const startsAt = 'startsAt' in body ? toSqlDatetime(body.startsAt) : row.starts_at;
    const endsAt = 'endsAt' in body ? toSqlDatetime(body.endsAt) : row.ends_at;
    if (!startsAt || !endsAt) return error(400, 'Invalid start or end time');
    if (endsAt <= startsAt) return error(400, 'The end time must be after the start');
    set.push('starts_at = ?', 'ends_at = ?');
    vals.push(startsAt, endsAt);
  }

  if ('stepId' in body) {
    let stepId = typeof body.stepId === 'string' && body.stepId ? body.stepId : null;
    if (stepId) {
      const step = await context.env.DB.prepare(
        'SELECT id FROM project_steps WHERE id = ? AND project_id = ?'
      )
        .bind(stepId, id)
        .first();
      if (!step) return error(400, 'That step is not on this project');
    }
    set.push('step_id = ?');
    vals.push(stepId);
  }

  if ('note' in body) {
    set.push('note = ?');
    vals.push(trimOrNull(body.note, NOTE_MAX));
  }

  if ('status' in body) {
    if (!WS_STATUSES.includes(body.status)) return error(400, 'Invalid status');
    set.push('status = ?');
    vals.push(body.status);
  }

  if (!set.length) return error(400, 'Nothing to update');

  await context.env.DB.prepare(`UPDATE work_sessions SET ${set.join(', ')} WHERE id = ?`)
    .bind(...vals, sessionId)
    .run();

  const updated = await context.env.DB.prepare(
    `SELECT ${SESSION_SELECT} FROM work_sessions ws ${SESSION_JOINS} WHERE ws.id = ?`
  )
    .bind(sessionId)
    .first();
  return json({ session: shapeSession(updated, g.user.id) });
}

// DELETE /api/projects/:id/sessions/:sessionId — planner only.
export async function onRequestDelete(context) {
  const { id, sessionId } = context.params;
  const g = await requireProject(context, id, 'viewer');
  if (g.fail) return g.fail;

  const row = await loadSession(context.env, id, sessionId);
  if (!row) return error(404, 'Session not found');
  if (row.user_id !== g.user.id) return error(403, 'That focus time belongs to someone else');

  await context.env.DB.prepare('DELETE FROM work_sessions WHERE id = ?').bind(sessionId).run();
  return json({ ok: true });
}
