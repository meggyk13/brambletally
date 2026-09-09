import { json, error, readJson } from '../lib/http.js';
import { uuid, randomToken, sha256Hex } from '../lib/id.js';
import { sqlNow } from '../lib/time.js';
import { sendEmailChangeLink } from '../lib/email.js';
import { MAGIC_LINK_TTL_MIN, appOrigin } from '../lib/constants.js';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// POST /api/settings/email — { email }. Starts an email change: a confirm link
// is mailed to the NEW address, and nothing on the account moves until that
// link is used (worker/api/auth/email-change.js). Any earlier pending request
// for this user is retired first — one live request at a time.
export async function onRequestPost(context) {
  const { env, request } = context;
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');

  const body = await readJson(request);
  const email = String((body && body.email) || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return error(400, 'Enter a valid email address');
  if (email === String(me.email || '').toLowerCase())
    return error(400, "That's already your address");

  const taken = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first();
  if (taken) return error(409, 'That address is already in use');

  const token = randomToken(32);
  await env.DB.batch([
    env.DB
      .prepare(
        "UPDATE email_change_requests SET used_at = ? WHERE user_id = ? AND used_at IS NULL"
      )
      .bind(sqlNow(), me.id),
    env.DB
      .prepare(
        `INSERT INTO email_change_requests (id, user_id, new_email, token_hash, expires_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(
        uuid(),
        me.id,
        email,
        await sha256Hex(token),
        sqlNow(MAGIC_LINK_TTL_MIN * 60 * 1000)
      ),
  ]);

  const link = `${appOrigin(env)}/api/auth/email-change?token=${token}`;
  const sent = await sendEmailChangeLink(env, email, link);
  if (!sent.ok) return error(502, 'Could not send the email just now. Try again in a moment.');

  return json({ ok: true });
}
