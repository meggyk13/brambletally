import { json, error } from '../lib/http.js';
import { shapeSession, SESSION_SELECT, SESSION_JOINS } from '../lib/worksessions.js';

// GET /api/sessions/:id — one of the caller's own sessions. Backs the
// ?focus=<sessionId> deep link from a calendar event.
export async function onRequestGet(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');

  const row = await context.env.DB.prepare(
    `SELECT ${SESSION_SELECT}
       FROM work_sessions ws ${SESSION_JOINS}
      WHERE ws.id = ? AND ws.user_id = ?`
  )
    .bind(context.params.id, me.id)
    .first();
  if (!row) return error(404, 'Session not found');

  return json({ session: shapeSession(row, me.id) });
}
