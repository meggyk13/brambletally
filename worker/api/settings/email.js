import { json, error, readJson } from '../lib/http.js';
import { uuid, randomToken, sha256Hex } from '../lib/id.js';
import { sqlNow } from '../lib/time.js';
import { sendEmailChangeLink } from '../lib/email.js';
import { MAGIC_LINK_TTL_MIN, appOrigin } from '../lib/constants.js';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// This sends a real email to an address the caller doesn't necessarily
// control — nothing previously stopped repeatedly re-targeting the same (or
// a different) address (docs/plan.md "Data-integrity hardening pass 2", B1).
// Same rolling-24h count pattern as REQUEST_DAILY_CAP/REPORT_DAILY_CAP.
const EMAIL_CHANGE_DAILY_CAP = 5;

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

  const recent = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM email_change_requests
      WHERE user_id = ? AND created_at > datetime('now', '-1 day')`
  )
    .bind(me.id)
    .first();
  if ((recent.n || 0) >= EMAIL_CHANGE_DAILY_CAP) {
    return error(429, "You've requested a lot of email changes today. Try again tomorrow.");
  }

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
