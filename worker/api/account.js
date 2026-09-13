import { json, error } from './lib/http.js';
import { clearCookie } from './lib/sessions.js';
import { hasSharedOwnedProjects, cascadeDeleteUserStatements } from './lib/userDelete.js';

// DELETE /api/account — permanent. `projects` cascades from `owner_id`, so an
// unguarded delete would wipe every shared project the caller owns and revoke
// everyone else's access with it. Refuse while any owned project still has
// another collaborator; the caller must transfer or remove them first.
//
// That guard only covers *currently owned* shared projects. Several other
// users(id) columns have no ON DELETE action at all — a project transferred
// away, an invite sent, a contributor request decided, a journal entry on
// someone else's project, or (admin) a moderation action all leave a
// reference behind with no cascade. cascadeDeleteUserStatements reassigns
// those onto the permanent `deleted-user` placeholder (migration 0018)
// before the real DELETE, the same shape callback.js's mergeAnonymousInto
// uses for a claimed account — see docs/plan.md "Data-integrity hardening
// pass", A1. Also reused by the admin anonymous-account purge.
export async function onRequestDelete(context) {
  const { env } = context;
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');

  if (await hasSharedOwnedProjects(env, me.id)) {
    return error(
      409,
      'Transfer or remove the other people from your shared projects before deleting your account.'
    );
  }

  await env.DB.batch(cascadeDeleteUserStatements(env, me.id));

  const res = json({ ok: true });
  res.headers.append('Set-Cookie', clearCookie());
  return res;
}
