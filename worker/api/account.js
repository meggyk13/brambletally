import { json, error } from '../lib/http.js';
import { readCookie, clearCookie } from '../lib/sessions.js';
import { SESSION_COOKIE } from '../lib/constants.js';

// DELETE /api/account — permanent. `projects` cascades from `owner_id`, so an
// unguarded delete would wipe every shared project the caller owns and revoke
// everyone else's access with it. Refuse while any owned project still has
// another collaborator; the caller must transfer or remove them first.
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
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(me.id).run();

  const res = json({ ok: true });
  res.headers.append('Set-Cookie', clearCookie());
  return res;
}
