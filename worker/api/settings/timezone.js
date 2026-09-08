import { json, error, readJson } from '../lib/http.js';

// Is `tz` a usable IANA time-zone name? Intl.DateTimeFormat throws RangeError
// on an unknown zone — the canonical validity check, no allowlist needed.
function isValidZone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// PATCH /api/settings/timezone — { timezone } — set or clear the caller's IANA
// zone. Clearing (null / '') falls back to DEFAULT_TZ everywhere it's read.
export async function onRequestPatch(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');

  const body = await readJson(context.request);
  if (!body || !('timezone' in body)) return error(400, 'timezone required');

  let tz = body.timezone;
  if (tz === null || tz === '') {
    tz = null;
  } else if (typeof tz !== 'string' || tz.length > 64 || !isValidZone(tz)) {
    return error(400, 'Unknown time zone');
  }

  await context.env.DB.prepare('UPDATE users SET timezone = ? WHERE id = ?')
    .bind(tz, me.id)
    .run();

  return json({ timezone: tz });
}
