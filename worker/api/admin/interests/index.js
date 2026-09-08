import { json, error } from '../../lib/http.js';
import { requireAdmin } from '../../lib/admin.js';

// GET /api/admin/interests?q=  — every tag, most-used first, optional filter.
export async function onRequestGet(context) {
  const g = requireAdmin(context);
  if (g.fail) return g.fail;

  const q = (new URL(context.request.url).searchParams.get('q') || '').trim().toLowerCase();

  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = await context.env.DB.prepare(
      `SELECT id, slug, label, usage_count, created_at FROM interest_tags
        WHERE slug LIKE ? OR lower(label) LIKE ?
        ORDER BY usage_count DESC, label COLLATE NOCASE LIMIT 200`
    )
      .bind(like, like)
      .all();
  } else {
    rows = await context.env.DB.prepare(
      `SELECT id, slug, label, usage_count, created_at FROM interest_tags
        ORDER BY usage_count DESC, label COLLATE NOCASE LIMIT 200`
    ).all();
  }

  return json({ tags: rows.results || [] });
}
