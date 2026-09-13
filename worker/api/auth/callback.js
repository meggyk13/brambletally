import { uuid, sha256Hex } from '../lib/id.js';
import { sqlNow } from '../lib/time.js';
import { createSession, sessionCookie } from '../lib/sessions.js';
import { APP_PATH } from '../lib/constants.js';

function redirect(location, cookie) {
  const res = new Response(null, { status: 302, headers: { Location: location } });
  if (cookie) res.headers.append('Set-Cookie', cookie);
  return res;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return redirect(`${APP_PATH}?auth=invalid`);

  // Claim the token in a single atomic UPDATE: two concurrent hits on the same
  // link (mail-scanner prefetch, double-click) can't both come back with a row.
  const link = await env.DB.prepare(
    `UPDATE magic_links SET used_at = ?
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')
      RETURNING id, email, claim_user_id`
  )
    .bind(sqlNow(), await sha256Hex(token))
    .first();

  if (!link) return redirect(`${APP_PATH}?auth=invalid`);

  let user = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(link.email)
    .first();

  if (!user && link.claim_user_id) {
    // "Save your project" (docs/plan.md part C): this anonymous account has no
    // account at this email yet, so it becomes a real one in place — same id,
    // same projects, just claimed.
    await env.DB.prepare('UPDATE users SET email = ? WHERE id = ?')
      .bind(link.email, link.claim_user_id)
      .run();
    user = { id: link.claim_user_id };
  } else if (!user) {
    const id = uuid();
    // DO NOTHING + re-select: if the same new address signed in twice at once,
    // whichever INSERT lands first wins and both requests resolve to that id.
    await env.DB.prepare(
      'INSERT INTO users (id, email, name) VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING'
    )
      .bind(id, link.email, link.email.split('@')[0])
      .run();
    user = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind(link.email)
      .first();
  } else if (link.claim_user_id && link.claim_user_id !== user.id) {
    // The claimed address already belongs to someone else: fold this
    // anonymous account's projects into that account and drop the anonymous
    // row, rather than leaving two accounts behind.
    await mergeAnonymousInto(env, link.claim_user_id, user.id);
  }

  await resolvePendingInvites(env, link.email, user.id);

  const session = await createSession(env, user.id);
  return redirect(APP_PATH, sessionCookie(session.id));
}

// Reassigns everything an anonymous account owns/collaborates on onto an
// existing account, then removes the now-empty anonymous row. D1 enforces
// foreign keys at runtime (unlike a `wrangler d1 execute` migration), so every
// users(id) reference the anon account could plausibly hold — not just
// projects/collaborators — must move first or the final DELETE fails its
// constraint check. project_listings/pending_invites/ownership_transfer_log
// cover what an anonymous owner can create (board listing, invite, transfer);
// magic_links.claim_user_id is the row this very request is processing.
async function mergeAnonymousInto(env, anonId, targetId) {
  await env.DB.batch([
    env.DB.prepare('UPDATE projects SET owner_id = ? WHERE owner_id = ?').bind(targetId, anonId),
    // Drop anon collaborator rows that would collide with one the target
    // already has on the same project, then reassign the rest.
    env.DB.prepare(
      `DELETE FROM project_collaborators
        WHERE user_id = ?
          AND project_id IN (SELECT project_id FROM project_collaborators WHERE user_id = ?)`
    ).bind(anonId, targetId),
    env.DB.prepare('UPDATE project_collaborators SET user_id = ? WHERE user_id = ?').bind(
      targetId,
      anonId
    ),
    env.DB.prepare('UPDATE project_listings SET created_by = ? WHERE created_by = ?').bind(
      targetId,
      anonId
    ),
    env.DB.prepare('UPDATE contributor_requests SET decided_by = ? WHERE decided_by = ?').bind(
      targetId,
      anonId
    ),
    env.DB.prepare('UPDATE pending_invites SET invited_by = ? WHERE invited_by = ?').bind(
      targetId,
      anonId
    ),
    env.DB.prepare(
      'UPDATE ownership_transfer_log SET from_user_id = ? WHERE from_user_id = ?'
    ).bind(targetId, anonId),
    env.DB.prepare('UPDATE ownership_transfer_log SET to_user_id = ? WHERE to_user_id = ?').bind(
      targetId,
      anonId
    ),
    env.DB.prepare('UPDATE magic_links SET claim_user_id = NULL WHERE claim_user_id = ?').bind(
      anonId
    ),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(anonId),
  ]);
}

// Turn any email invites for this address into real collaborator rows.
async function resolvePendingInvites(env, email, userId) {
  const { results } = await env.DB.prepare(
    'SELECT id, project_id, role FROM pending_invites WHERE email = ? AND accepted_at IS NULL'
  )
    .bind(email)
    .all();

  for (const inv of results) {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO project_collaborators (project_id, user_id, role) VALUES (?, ?, ?)
         ON CONFLICT(project_id, user_id) DO UPDATE SET role = excluded.role`
      ).bind(inv.project_id, userId, inv.role),
      env.DB.prepare('UPDATE pending_invites SET accepted_at = ? WHERE id = ?')
        .bind(sqlNow(), inv.id),
    ]);
  }
}
