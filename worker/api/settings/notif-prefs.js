import { json, error, readJson } from '../lib/http.js';
import { sanitizeNotifPrefs } from '../lib/notif.js';

// PATCH /api/settings/notif-prefs — store the caller's notification preferences.
// Nothing sends yet; this just persists the choice so it's ready for Phase 3.
export async function onRequestPatch(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');

  const body = await readJson(context.request);
  const prefs = sanitizeNotifPrefs(body);

  await context.env.DB.prepare(
    `INSERT INTO user_profiles (user_id, notif_prefs, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       notif_prefs = excluded.notif_prefs,
       updated_at = datetime('now')`
  )
    .bind(me.id, JSON.stringify(prefs))
    .run();

  return json({ notif_prefs: prefs });
}
