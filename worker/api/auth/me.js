import { json, error } from '../lib/http.js';
import { isSupporter } from '../lib/plan.js';
import { readNotifPrefs } from '../lib/notif.js';

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user) return error(401, 'Not signed in');

  const prefs = await context.env.DB.prepare(
    'SELECT notif_prefs FROM user_profiles WHERE user_id = ?'
  )
    .bind(user.id)
    .first();

  return json({
    user,
    needs_handle: !user.handle,
    supporter: isSupporter(user),
    notif_prefs: readNotifPrefs(prefs && prefs.notif_prefs),
  });
}
