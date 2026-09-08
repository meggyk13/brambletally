import { json, error } from './lib/http.js';
import {
  toSqlDatetime,
  shapeSession,
  SESSION_SELECT,
  SESSION_JOINS,
} from './lib/worksessions.js';

// GET /api/sessions?from=&to= — the caller's own planned focus time across all
// their projects, for the home "next focus" line and any agenda view. Defaults
// to [now, now + 30 days] when the range is omitted. Past sessions are excluded
// unless `from` reaches back for them.
export async function onRequestGet(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');

  const url = new URL(context.request.url);
  const from = toSqlDatetime(url.searchParams.get('from')) ||
    new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
  const to =
    toSqlDatetime(url.searchParams.get('to')) ||
    new Date(Date.now() + 30 * 86400 * 1000).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');

  const { results } = await context.env.DB.prepare(
    `SELECT ${SESSION_SELECT}
       FROM work_sessions ws ${SESSION_JOINS}
      WHERE ws.user_id = ?
        AND ws.starts_at >= ?
        AND ws.starts_at < ?
      ORDER BY ws.starts_at`
  )
    .bind(me.id, from, to)
    .all();

  return json({ sessions: (results || []).map((r) => shapeSession(r, me.id)) });
}
