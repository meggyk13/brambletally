import { json, error } from '../lib/http.js';
import { isSupporter } from '../lib/plan.js';
import { readNotifPrefs } from '../lib/notif.js';
import { boardActionCount, TURNSTILE_UNTIL_ACTIONS } from '../lib/board.js';
import { needsTos } from '../lib/legal.js';
import { TOS_VERSION } from '../lib/constants.js';

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user) return error(401, 'Not signed in');
  const needsTosNow = needsTos(user);

  const [prefs, unread, boardActions, invite] = await Promise.all([
    context.env.DB.prepare('SELECT notif_prefs FROM user_profiles WHERE user_id = ?')
      .bind(user.id)
      .first(),
    context.env.DB.prepare(
      'SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL'
    )
      .bind(user.id)
      .first(),
    boardActionCount(context.env, user.id),
    // Invite context for the acceptance screen (docs/plan.md part D): only
    // worth the query while it'll actually be shown. Most-recent non-owner
    // collaborator row, joined to the project and its owner (the inviter —
    // POST collaborators.js only lets the owner invite).
    needsTosNow ? inviteContext(context.env, user.id) : null,
  ]);

  return json({
    user,
    // A handle is a social/sharing concept, so an anonymous (email IS NULL)
    // account defers it to whenever they claim the account or accept an
    // invite — no handle prompt in between.
    needs_handle: !user.handle && !!user.email,
    needs_tos: needsTosNow,
    invite,
    tos_version: TOS_VERSION,
    supporter: isSupporter(user),
    notif_prefs: readNotifPrefs(prefs && prefs.notif_prefs),
    unread_count: (unread && unread.n) || 0,
    // The board request / report forms show a Turnstile challenge while true.
    board_new: boardActions < TURNSTILE_UNTIL_ACTIONS,
  });
}

async function inviteContext(env, userId) {
  const row = await env.DB
    .prepare(
      `SELECT p.title AS project_title,
              COALESCE(owner.display_name, owner.name, owner.handle) AS inviter_name
         FROM project_collaborators pc
         JOIN projects p ON p.id = pc.project_id
         JOIN users owner ON owner.id = p.owner_id
        WHERE pc.user_id = ? AND pc.role != 'owner'
        ORDER BY pc.added_at DESC
        LIMIT 1`
    )
    .bind(userId)
    .first();
  return row || null;
}
