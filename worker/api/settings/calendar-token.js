import { json, error } from '../lib/http.js';
import { randomToken } from '../lib/id.js';
import { appOrigin } from '../lib/constants.js';

const feedUrl = (env, token) => `${appOrigin(env)}/api/calendar/${token}.ics`;

async function ensureToken(env, userId) {
  const row = await env.DB.prepare('SELECT calendar_token FROM users WHERE id = ?')
    .bind(userId)
    .first();
  if (row && row.calendar_token) return row.calendar_token;
  const token = randomToken(24);
  await env.DB.prepare('UPDATE users SET calendar_token = ? WHERE id = ?')
    .bind(token, userId)
    .run();
  return token;
}

// GET /api/settings/calendar-token — the caller's feed URL, minting a token on
// first read.
export async function onRequestGet(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');
  const token = await ensureToken(context.env, me.id);
  return json({ token, url: feedUrl(context.env, token) });
}

// POST /api/settings/calendar-token — regenerate. The old feed URL stops
// working immediately.
export async function onRequestPost(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');
  const token = randomToken(24);
  await context.env.DB.prepare('UPDATE users SET calendar_token = ? WHERE id = ?')
    .bind(token, me.id)
    .run();
  return json({ token, url: feedUrl(context.env, token) });
}
