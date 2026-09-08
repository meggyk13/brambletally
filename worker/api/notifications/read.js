import { json, error, readJson } from '../lib/http.js';

// POST /api/notifications/read — { ids?: string[] }. Marks the given
// notifications read, or all of the caller's unread ones when ids is omitted.
export async function onRequestPost(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');

  const body = await readJson(context.request);
  const ids = Array.isArray(body && body.ids)
    ? body.ids.filter((x) => typeof x === 'string').slice(0, 200)
    : null;

  if (ids && ids.length === 0) return json({ ok: true, updated: 0 });

  let stmt;
  if (ids) {
    const ph = ids.map(() => '?').join(',');
    stmt = context.env.DB.prepare(
      `UPDATE notifications SET read_at = datetime('now')
        WHERE user_id = ? AND read_at IS NULL AND id IN (${ph})`
    ).bind(me.id, ...ids);
  } else {
    stmt = context.env.DB.prepare(
      "UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL"
    ).bind(me.id);
  }
  const res = await stmt.run();
  return json({ ok: true, updated: res.meta.changes || 0 });
}
