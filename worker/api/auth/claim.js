import { json, error, readJson } from '../lib/http.js';
import { uuid, randomToken, sha256Hex } from '../lib/id.js';
import { sqlNow } from '../lib/time.js';
import { sendMagicLink } from '../lib/email.js';
import { MAGIC_LINK_TTL_MIN, appOrigin } from '../lib/constants.js';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// POST /api/auth/claim — { email }. "Save your project" (docs/plan.md part
// C): mails a sign-in link that, when clicked, either turns this anonymous
// account into a real one at that address or — if the address already has an
// account — folds this session's projects into it
// (worker/api/auth/callback.js). No Turnstile check: this only fires from an
// already-authenticated anonymous session, not an open unauthenticated form.
export async function onRequestPost(context) {
  const { env, request } = context;
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');
  if (me.email) return error(400, 'This account already has an email');

  const body = await readJson(request);
  const email = String((body && body.email) || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return error(400, 'Enter a valid email address');

  const token = randomToken(32);
  await env.DB.prepare(
    `INSERT INTO magic_links (id, email, token_hash, expires_at, claim_user_id)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(uuid(), email, await sha256Hex(token), sqlNow(MAGIC_LINK_TTL_MIN * 60 * 1000), me.id)
    .run();

  const link = `${appOrigin(env)}/api/auth/callback?token=${token}`;
  const sent = await sendMagicLink(env, email, link);
  if (!sent.ok) return error(502, 'Could not send the email just now. Try again in a moment.');

  return json({ ok: true });
}
