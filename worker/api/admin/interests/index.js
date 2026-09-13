import { json } from '../../lib/http.js';
import { requireAdmin } from '../../lib/admin.js';

const PAGE = 100;

// GET /api/admin/interests?cursor=&q=&unused=1 — every tag, most-used first.
// `q` filters on slug/label; `unused=1` narrows to usage_count = 0 (the
// natural view for cleanup work). Paginated — previously a hard LIMIT 200
// with no way past it and no signal you'd hit it.
export async function onRequestGet(context) {
  const g = requireAdmin(context);
  if (g.fail) return g.fail;

  const params = new URL(context.request.url).searchParams;
  const offset = Math.max(0, parseInt(params.get('cursor') || '0', 10) || 0);
  const q = (params.get('q') || '').trim().toLowerCase();
  const unusedOnly = params.get('unused') === '1';

  const conds = [];
  const binds = [];
  if (q) {
    conds.push('(slug LIKE ? OR lower(label) LIKE ?)');
    const like = `%${q}%`;
    binds.push(like, like);
  }
  if (unusedOnly) conds.push('usage_count = 0');
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const { results } = await context.env.DB.prepare(
    `SELECT id, slug, label, usage_count, created_at FROM interest_tags
      ${where}
      ORDER BY usage_count DESC, label COLLATE NOCASE
      LIMIT ? OFFSET ?`
  )
    .bind(...binds, PAGE + 1, offset)
    .all();

  const hasMore = results.length > PAGE;
  const tags = results.slice(0, PAGE);

  return json({ tags, next_cursor: hasMore ? String(offset + PAGE) : null });
}
