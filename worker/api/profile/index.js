import { json, error, readJson } from '../lib/http.js';
import { pick, trimOrNull } from '../lib/validate.js';

// PATCH /api/profile — the caller's own profile. display_name lives on `users`;
// bio + pronouns live on the 1:1 user_profiles row (upserted here). Any subset
// of the three keys may be sent.
export async function onRequestPatch(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');

  const body = await readJson(context.request);
  const src = body ? pick(body, ['display_name', 'bio', 'pronouns']) : {};
  if (Object.keys(src).length === 0) return error(400, 'Nothing to update');

  const out = {};
  const stmts = [];

  if ('display_name' in src) {
    out.display_name = trimOrNull(src.display_name, 50);
    stmts.push(
      context.env.DB.prepare('UPDATE users SET display_name = ? WHERE id = ?').bind(
        out.display_name,
        me.id
      )
    );
  }

  if ('bio' in src || 'pronouns' in src) {
    // Read-modify-write the profile row so an absent key isn't nulled.
    const existing = await context.env.DB.prepare(
      'SELECT bio, pronouns FROM user_profiles WHERE user_id = ?'
    )
      .bind(me.id)
      .first();
    const bio = 'bio' in src ? trimOrNull(src.bio, 500) : (existing ? existing.bio : null);
    const pronouns =
      'pronouns' in src ? trimOrNull(src.pronouns, 40) : (existing ? existing.pronouns : null);
    out.bio = bio;
    out.pronouns = pronouns;
    stmts.push(
      context.env.DB.prepare(
        `INSERT INTO user_profiles (user_id, bio, pronouns, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET
           bio = excluded.bio,
           pronouns = excluded.pronouns,
           updated_at = datetime('now')`
      ).bind(me.id, bio, pronouns)
    );
  }

  await context.env.DB.batch(stmts);
  return json(out);
}
