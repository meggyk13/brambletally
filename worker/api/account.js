import { json, error } from './lib/http.js';
import { readCookie, clearCookie } from './lib/sessions.js';
import { SESSION_COOKIE, DELETED_USER_ID } from './lib/constants.js';

// DELETE /api/account — permanent. `projects` cascades from `owner_id`, so an
// unguarded delete would wipe every shared project the caller owns and revoke
// everyone else's access with it. Refuse while any owned project still has
// another collaborator; the caller must transfer or remove them first.
//
// That guard only covers *currently owned* shared projects. Several other
// users(id) columns have no ON DELETE action at all — a project transferred
// away, an invite sent, a contributor request decided, a journal entry on
// someone else's project, or (admin) a moderation action all leave a
// reference behind with no cascade. Reassign those onto the permanent
// `deleted-user` placeholder (migration 0018) before the real DELETE, the
// same shape callback.js's mergeAnonymousInto uses for a claimed account —
// see docs/plan.md "Data-integrity hardening pass", A1.
export async function onRequestDelete(context) {
  const { env, request } = context;
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');

  const shared = await env.DB.prepare(
    `SELECT COUNT(*) AS n
       FROM project_collaborators pc JOIN projects p ON p.id = pc.project_id
      WHERE p.owner_id = ? AND pc.user_id != ?`
  )
    .bind(me.id, me.id)
    .first();

  if (shared && shared.n > 0) {
    return error(
      409,
      'Transfer or remove the other people from your shared projects before deleting your account.'
    );
  }

  const sid = readCookie(request, SESSION_COOKIE);
  await env.DB.batch([
    env.DB.prepare('UPDATE project_listings SET created_by = ? WHERE created_by = ?').bind(
      DELETED_USER_ID,
      me.id
    ),
    env.DB.prepare('UPDATE contributor_requests SET decided_by = ? WHERE decided_by = ?').bind(
      DELETED_USER_ID,
      me.id
    ),
    env.DB.prepare('UPDATE pending_invites SET invited_by = ? WHERE invited_by = ?').bind(
      DELETED_USER_ID,
      me.id
    ),
    env.DB.prepare(
      'UPDATE ownership_transfer_log SET from_user_id = ? WHERE from_user_id = ?'
    ).bind(DELETED_USER_ID, me.id),
    env.DB.prepare(
      'UPDATE ownership_transfer_log SET to_user_id = ? WHERE to_user_id = ?'
    ).bind(DELETED_USER_ID, me.id),
    env.DB.prepare('UPDATE project_journal SET user_id = ? WHERE user_id = ?').bind(
      DELETED_USER_ID,
      me.id
    ),
    env.DB.prepare('UPDATE moderation_actions SET admin_id = ? WHERE admin_id = ?').bind(
      DELETED_USER_ID,
      me.id
    ),
    env.DB.prepare('UPDATE reports SET resolved_by = ? WHERE resolved_by = ?').bind(
      DELETED_USER_ID,
      me.id
    ),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(me.id),
  ]);

  const res = json({ ok: true });
  res.headers.append('Set-Cookie', clearCookie());
  return res;
}
