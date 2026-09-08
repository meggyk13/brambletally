import { json, error } from '../lib/http.js';
import { isSupporter } from '../lib/plan.js';
import { readNotifPrefs } from '../lib/notif.js';
import { boardActionCount, TURNSTILE_UNTIL_ACTIONS } from '../lib/board.js';
import { needsTos } from '../lib/legal.js';
import { TOS_VERSION } from '../lib/constants.js';

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user) return error(401, 'Not signed in');

  const [prefs, unread, boardActions] = await Promise.all([
    context.env.DB.prepare('SELECT notif_prefs FROM user_profiles WHERE user_id = ?')
      .bind(user.id)
      .first(),
    context.env.DB.prepare(
      'SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL'
    )
      .bind(user.id)
      .first(),
    boardActionCount(context.env, user.id),
  ]);

  return json({
    user,
    needs_handle: !user.handle,
    needs_tos: needsTos(user),
    tos_version: TOS_VERSION,
    supporter: isSupporter(user),
    notif_prefs: readNotifPrefs(prefs && prefs.notif_prefs),
    unread_count: (unread && unread.n) || 0,
    // The board request / report forms show a Turnstile challenge while true.
    board_new: boardActions < TURNSTILE_UNTIL_ACTIONS,
  });
}
