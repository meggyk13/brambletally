import { json, error } from '../lib/http.js';
import { isSupporter } from '../lib/plan.js';

const PAGE = 30;

// GET /api/interests/:slug — discovery list: signed-in users who share this
// interest tag. Paged with ?cursor=<offset>. Disabled accounts are excluded.
export async function onRequestGet(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');

  const slug = String(context.params.slug || '').trim().toLowerCase();
  const tag = await context.env.DB.prepare(
    'SELECT slug, label, usage_count FROM interest_tags WHERE slug = ?'
  )
    .bind(slug)
    .first();
  if (!tag) return error(404, 'No such interest');

  const offset = Math.max(0, parseInt(new URL(context.request.url).searchParams.get('cursor') || '0', 10) || 0);

  const { results } = await context.env.DB.prepare(
    `SELECT u.handle, u.display_name, u.name, u.plan
       FROM user_interests ui
       JOIN interest_tags t ON t.id = ui.tag_id
       JOIN users u ON u.id = ui.user_id
      WHERE t.slug = ? AND u.disabled_at IS NULL AND u.handle IS NOT NULL
      ORDER BY COALESCE(u.display_name, u.name, u.handle) COLLATE NOCASE
      LIMIT ? OFFSET ?`
  )
    .bind(slug, PAGE + 1, offset)
    .all();

  const hasMore = results.length > PAGE;
  const users = results.slice(0, PAGE).map((u) => ({
    handle: u.handle,
    display_name: u.display_name,
    name: u.name,
    supporter: isSupporter(u),
  }));

  return json({
    tag,
    users,
    next_cursor: hasMore ? String(offset + PAGE) : null,
  });
}
