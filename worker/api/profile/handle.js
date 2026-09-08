import { json, error, readJson } from '../lib/http.js';
import { normalizeHandle } from '../lib/handle.js';
import { sqlNow, parseSql } from '../lib/time.js';

const CHANGE_COOLDOWN_DAYS = 30;

// PUT /api/profile/handle — set or change the caller's @handle. First set is
// always allowed (the first-login prompt). A later change is refused within
// 30 days of the previous one.
export async function onRequestPut(context) {
  const { env } = context;
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');

  const body = await readJson(context.request);
  const result = normalizeHandle(body && body.handle);
  if (result.error) return error(400, result.error);
  const handle = result.handle;

  if (handle === me.handle) return json({ handle });

  if (me.handle) {
    const row = await env.DB.prepare('SELECT handle_set_at FROM users WHERE id = ?')
      .bind(me.id)
      .first();
    if (row && row.handle_set_at) {
      const days = (Date.now() - parseSql(row.handle_set_at).getTime()) / 86400000;
      if (days < CHANGE_COOLDOWN_DAYS) {
        const left = Math.ceil(CHANGE_COOLDOWN_DAYS - days);
        return error(429, `You can change your handle again in ${left} day${left === 1 ? '' : 's'}.`);
      }
    }
  }

  try {
    await env.DB.prepare('UPDATE users SET handle = ?, handle_set_at = ? WHERE id = ?')
      .bind(handle, sqlNow(), me.id)
      .run();
  } catch (e) {
    // The only constraint on this write is the unique handle index.
    return error(409, 'That handle is already taken.');
  }
  return json({ handle });
}
