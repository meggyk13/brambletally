import { json, error, readJson } from '../lib/http.js';
import { trimOrNull } from '../lib/validate.js';

// PATCH /api/profile — the caller's own profile. Phase 1a: display_name only.
// bio / pronouns / links arrive with user_profiles in Phase 1b.
export async function onRequestPatch(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');

  const body = await readJson(context.request);
  if (!body || !('display_name' in body)) return error(400, 'Nothing to update');

  const display_name = trimOrNull(body.display_name, 50);
  await context.env.DB.prepare('UPDATE users SET display_name = ? WHERE id = ?')
    .bind(display_name, me.id)
    .run();
  return json({ display_name });
}
