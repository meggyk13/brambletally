import { json, error } from '../lib/http.js';
import { isSupporter } from '../lib/plan.js';
import { blockedBetween } from '../lib/blocks.js';

// GET /api/profile/:handle — the public-within-login profile bundle. Signed-in
// only. A disabled account's profile — and either party of a block — 404s to
// everyone but the account itself.
export async function onRequestGet(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');

  let handle = String(context.params.handle || '').trim().toLowerCase();
  if (handle.startsWith('@')) handle = handle.slice(1);
  if (!handle) return error(404, 'No such profile');

  const u = await context.env.DB.prepare(
    `SELECT u.id, u.handle, u.display_name, u.name, u.plan, u.is_admin,
            u.disabled_at, u.created_at,
            p.bio AS bio, p.pronouns AS pronouns
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
      WHERE u.handle = ?`
  )
    .bind(handle)
    .first();

  if (!u) return error(404, 'No such profile');
  const is_self = u.id === me.id;
  if (u.disabled_at && !is_self) return error(404, 'No such profile');
  if (!is_self && (await blockedBetween(context.env, me.id, u.id)))
    return error(404, 'No such profile');

  const [{ results: links }, { results: interests }] = await Promise.all([
    context.env.DB.prepare(
      'SELECT platform, value FROM user_links WHERE user_id = ? ORDER BY sort_order'
    )
      .bind(u.id)
      .all(),
    context.env.DB.prepare(
      `SELECT t.slug, t.label
         FROM user_interests ui
         JOIN interest_tags t ON t.id = ui.tag_id
        WHERE ui.user_id = ?
        ORDER BY t.label COLLATE NOCASE`
    )
      .bind(u.id)
      .all(),
  ]);

  return json({
    profile: {
      handle: u.handle,
      display_name: u.display_name,
      name: u.name,
      is_admin: !!u.is_admin,
      supporter: isSupporter(u),
      created_at: u.created_at,
      bio: u.bio || null,
      pronouns: u.pronouns || null,
      links: links || [],
      interests: interests || [],
      is_self,
    },
  });
}
