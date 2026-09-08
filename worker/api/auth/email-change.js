import { sha256Hex } from '../lib/id.js';
import { sqlNow } from '../lib/time.js';
import { sendEmailChangedNotice } from '../lib/email.js';
import { APP_PATH } from '../lib/constants.js';

function redirect(location) {
  return new Response(null, { status: 302, headers: { Location: location } });
}

// GET /api/auth/email-change?token=... — confirm link, opened from the new
// address's inbox. Claims the token atomically, re-checks the address is still
// free, and swaps users.email. The session (keyed by id, not email) stays
// valid. Best-effort heads-up to the old address.
export async function onRequestGet(context) {
  const { request, env } = context;
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return redirect(`${APP_PATH}?email=invalid`);

  const req = await env.DB.prepare(
    `UPDATE email_change_requests SET used_at = ?
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')
      RETURNING user_id, new_email`
  )
    .bind(sqlNow(), await sha256Hex(token))
    .first();

  if (!req) return redirect(`${APP_PATH}?email=invalid`);

  // Someone else may have claimed this address between request and confirm.
  const clash = await env.DB.prepare('SELECT id FROM users WHERE email = ? AND id != ?')
    .bind(req.new_email, req.user_id)
    .first();
  if (clash) return redirect(`${APP_PATH}?email=taken`);

  const prior = await env.DB.prepare('SELECT email FROM users WHERE id = ?')
    .bind(req.user_id)
    .first();

  await env.DB.prepare('UPDATE users SET email = ? WHERE id = ?')
    .bind(req.new_email, req.user_id)
    .run();

  if (prior && prior.email && prior.email !== req.new_email) {
    context.waitUntil(
      sendEmailChangedNotice(env, prior.email, req.new_email).catch(() => {})
    );
  }

  return redirect(`${APP_PATH}?email=changed`);
}
