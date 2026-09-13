import { json, error } from '../../lib/http.js';
import { requireAdmin } from '../../lib/admin.js';
import { hasSharedOwnedProjects, cascadeDeleteUserStatements } from '../../lib/userDelete.js';

// DELETE /api/admin/anonymous/:id — purge one never-claimed (email IS NULL)
// account, e.g. from the Anonymous tab's per-row Delete. Re-checks
// email IS NULL server-side so a stale client list can't be used to delete a
// real account, and reuses the same cascade-safe reassignment DELETE /api/account
// uses (docs/plan.md "Data-integrity hardening pass", A1) since nothing rules
// out an anonymous owner having invited a collaborator before dropping off.
export async function onRequestDelete(context) {
  const g = requireAdmin(context);
  if (g.fail) return g.fail;
  const { env, params } = context;
  const id = params.id;

  const target = await env.DB.prepare('SELECT id FROM users WHERE id = ? AND email IS NULL')
    .bind(id)
    .first();
  if (!target) return error(404, 'Not an unclaimed account');

  if (await hasSharedOwnedProjects(env, id)) {
    return error(409, 'This account owns a project with other collaborators — cannot purge.');
  }

  await env.DB.batch(cascadeDeleteUserStatements(env, id));
  return json({ ok: true });
}
