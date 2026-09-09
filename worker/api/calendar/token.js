import { error } from '../lib/http.js';
import { appOrigin } from '../lib/constants.js';
import { buildCalendar } from '../lib/ics.js';

// GET /api/calendar/:token(.ics) — per-user ICS subscription feed. No cookie:
// the token IS the credential. Returns the caller's upcoming `planned` focus
// sessions. A calendar app polls this on its own schedule.
export async function onRequestGet(context) {
  const raw = context.params.token || '';
  const token = raw.replace(/\.ics$/i, '');
  if (!token || token.length < 16) return error(404, 'Not found');

  const user = await context.env.DB.prepare(
    'SELECT id FROM users WHERE calendar_token = ? AND disabled_at IS NULL'
  )
    .bind(token)
    .first();
  if (!user) return error(404, 'Not found');

  const { results } = await context.env.DB.prepare(
    `SELECT ws.id, ws.starts_at, ws.ends_at, ws.note, p.title AS project_title
       FROM work_sessions ws
       JOIN projects p ON p.id = ws.project_id
      WHERE ws.user_id = ?
        AND ws.status = 'planned'
        AND ws.ends_at > datetime('now', '-1 day')
      ORDER BY ws.starts_at
      LIMIT 500`
  )
    .bind(user.id)
    .all();

  const body = buildCalendar(results || [], appOrigin(context.env));
  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="brambletally.ics"',
      'Cache-Control': 'private, max-age=300',
    },
  });
}
