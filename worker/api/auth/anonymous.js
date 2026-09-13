import { json, error, readJson } from '../lib/http.js';
import { uuid } from '../lib/id.js';
import { verifyTurnstile } from '../lib/turnstile.js';
import { createSession, sessionCookie } from '../lib/sessions.js';
import { TOS_VERSION } from '../lib/constants.js';

// POST /api/auth/anonymous — "Start your first project" with no email at all.
// Creates a real `users` row (email = NULL, ToS pre-accepted) and a session;
// the client opens straight into the create-project form from here. Same
// Turnstile check as request-link.js: this is an unauthenticated endpoint
// that writes a real row (cascading to a project) on every hit.
export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await readJson(request);

  const ts = await verifyTurnstile(
    env,
    body && body.turnstileToken,
    request.headers.get('CF-Connecting-IP')
  );
  if (!ts.ok) return error(400, 'Bot check failed. Reload the page and try again.');

  const id = uuid();
  await env.DB.prepare(
    `INSERT INTO users (id, tos_accepted_at, tos_version) VALUES (?, datetime('now'), ?)`
  )
    .bind(id, TOS_VERSION)
    .run();

  const session = await createSession(env, id);
  return json({ ok: true }, { headers: { 'Set-Cookie': sessionCookie(session.id) } });
}
