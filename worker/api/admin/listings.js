import { json } from '../lib/http.js';
import { requireAdmin } from '../lib/admin.js';

const PAGE = 50;
const STATUSES = new Set(['open', 'closed', 'archived']);

// GET /api/admin/listings?cursor=&status=&q=  — every listing, newest first.
// `status` narrows to one of project_listings' CHECK values (default: all).
// `q` matches headline, project title, or owner handle/display name.
// Takedown reuses the owner-or-admin DELETE /api/board/:listingId.
export async function onRequestGet(context) {
  const g = requireAdmin(context);
  if (g.fail) return g.fail;

  const params = new URL(context.request.url).searchParams;
  const offset = Math.max(0, parseInt(params.get('cursor') || '0', 10) || 0);
  const status = params.get('status');
  const statusFilter = STATUSES.has(status) ? status : null;
  const q = (params.get('q') || '').trim().toLowerCase();

  const conds = [];
  const binds = [];
  if (statusFilter) {
    conds.push('l.status = ?');
    binds.push(statusFilter);
  }
  if (q) {
    conds.push(
      `(lower(l.headline) LIKE ? OR lower(p.title) LIKE ?
        OR lower(COALESCE(u.handle, '')) LIKE ? OR lower(COALESCE(u.display_name, '')) LIKE ?)`
    );
    const like = `%${q}%`;
    binds.push(like, like, like, like);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const { results } = await context.env.DB.prepare(
    `SELECT l.id, l.headline, l.status, l.created_at, l.updated_at,
            p.id AS project_id, p.title AS project_title,
            u.handle AS owner_handle, u.display_name AS owner_display_name, u.name AS owner_name,
            (SELECT COUNT(*) FROM listing_comments c WHERE c.listing_id = l.id AND c.deleted_at IS NULL) AS comment_count,
            (SELECT COUNT(*) FROM contributor_requests r WHERE r.listing_id = l.id AND r.status = 'pending') AS pending_requests
       FROM project_listings l
       JOIN projects p ON p.id = l.project_id
       JOIN users u ON u.id = p.owner_id
       ${where}
      ORDER BY l.updated_at DESC
      LIMIT ? OFFSET ?`
  )
    .bind(...binds, PAGE + 1, offset)
    .all();

  const hasMore = results.length > PAGE;
  const listings = results.slice(0, PAGE).map((r) => ({
    id: r.id,
    headline: r.headline,
    status: r.status,
    created_at: r.created_at,
    project_id: r.project_id,
    project_title: r.project_title,
    comment_count: r.comment_count,
    pending_requests: r.pending_requests,
    owner: {
      handle: r.owner_handle,
      display_name: r.owner_display_name,
      name: r.owner_name,
    },
  }));

  return json({ listings, next_cursor: hasMore ? String(offset + PAGE) : null });
}
