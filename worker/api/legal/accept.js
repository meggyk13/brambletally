import { json, error } from '../lib/http.js';
import { TOS_VERSION } from '../lib/constants.js';

// POST /api/legal/accept — records the caller's acceptance of the current
// Terms + Acceptable Use. One of the few routes reachable while the acceptance
// gate is in force.
export async function onRequestPost(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');

  await context.env.DB.prepare(
    "UPDATE users SET tos_accepted_at = datetime('now'), tos_version = ? WHERE id = ?"
  )
    .bind(TOS_VERSION, me.id)
    .run();

  return json({ ok: true, tos_version: TOS_VERSION });
}
