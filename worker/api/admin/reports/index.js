import { json, error } from '../../lib/http.js';
import { requireAdmin } from '../../lib/admin.js';

const STATUSES = ['open', 'actioned', 'dismissed', 'all'];
const PAGE = 50;

const person = (r, p = '') => ({
  handle: r[p + 'handle'],
  display_name: r[p + 'display_name'],
  name: r[p + 'name'],
});

// GET /api/admin/reports?status=open|actioned|dismissed|all  (default open)
export async function onRequestGet(context) {
  const g = requireAdmin(context);
  if (g.fail) return g.fail;

  const status = new URL(context.request.url).searchParams.get('status') || 'open';
  if (!STATUSES.includes(status)) return error(400, 'Bad status');
  const offset = Math.max(
    0,
    parseInt(new URL(context.request.url).searchParams.get('cursor') || '0', 10) || 0
  );

  const where = status === 'all' ? '' : 'WHERE r.status = ?1';
  const binds = status === 'all' ? [PAGE + 1, offset] : [status, PAGE + 1, offset];
  const { results } = await context.env.DB.prepare(
    `SELECT r.*,
            rep.handle AS rep_handle, rep.display_name AS rep_display_name, rep.name AS rep_name,
            res.handle AS res_handle, res.display_name AS res_display_name, res.name AS res_name
       FROM reports r
       LEFT JOIN users rep ON rep.id = r.reporter_id
       LEFT JOIN users res ON res.id = r.resolved_by
       ${where}
      ORDER BY r.created_at DESC
      LIMIT ${status === 'all' ? '?1 OFFSET ?2' : '?2 OFFSET ?3'}`
  )
    .bind(...binds)
    .all();

  const hasMore = results.length > PAGE;
  const page = results.slice(0, PAGE);

  // Resolve each target to a preview + its author.
  const listingIds = page.filter((r) => r.target_type === 'listing').map((r) => r.target_id);
  const commentIds = page.filter((r) => r.target_type === 'comment').map((r) => r.target_id);
  const profileIds = page.filter((r) => r.target_type === 'profile').map((r) => r.target_id);

  const fetchIn = async (ids, sql) => {
    if (!ids.length) return [];
    const ph = ids.map(() => '?').join(',');
    return (await context.env.DB.prepare(sql.replace('(?)', `(${ph})`)).bind(...ids).all()).results;
  };

  const listings = await fetchIn(
    listingIds,
    `SELECT l.id, l.headline, l.status, p.owner_id,
            u.handle, u.display_name, u.name
       FROM project_listings l JOIN projects p ON p.id = l.project_id
       JOIN users u ON u.id = p.owner_id WHERE l.id IN (?)`
  );
  const comments = await fetchIn(
    commentIds,
    `SELECT c.id, c.body, c.deleted_at, c.listing_id, c.user_id,
            u.handle, u.display_name, u.name
       FROM listing_comments c JOIN users u ON u.id = c.user_id WHERE c.id IN (?)`
  );
  const profiles = await fetchIn(
    profileIds,
    `SELECT id, handle, display_name, name, board_blocked_at, disabled_at
       FROM users WHERE id IN (?)`
  );
  const lMap = new Map(listings.map((x) => [x.id, x]));
  const cMap = new Map(comments.map((x) => [x.id, x]));
  const pMap = new Map(profiles.map((x) => [x.id, x]));

  const reports = page.map((r) => {
    let target = null;
    if (r.target_type === 'listing') {
      const x = lMap.get(r.target_id);
      target = x
        ? { exists: true, preview: x.headline, status: x.status, author: person(x), author_id: x.owner_id }
        : { exists: false };
    } else if (r.target_type === 'comment') {
      const x = cMap.get(r.target_id);
      target = x
        ? {
            exists: true,
            preview: x.deleted_at ? '(removed)' : (x.body || '').slice(0, 140),
            listing_id: x.listing_id,
            author: person(x),
            author_id: x.user_id,
          }
        : { exists: false };
    } else {
      const x = pMap.get(r.target_id);
      target = x
        ? {
            exists: true,
            preview: '@' + x.handle,
            author: person(x),
            author_id: x.id,
            board_blocked: !!x.board_blocked_at,
            disabled: !!x.disabled_at,
          }
        : { exists: false };
    }
    return {
      id: r.id,
      target_type: r.target_type,
      target_id: r.target_id,
      category: r.category,
      detail: r.detail,
      status: r.status,
      created_at: r.created_at,
      resolved_at: r.resolved_at,
      resolution_note: r.resolution_note,
      reporter: r.reporter_id ? person(r, 'rep_') : null,
      resolved_by: r.resolved_by ? person(r, 'res_') : null,
      target,
    };
  });

  return json({ reports, next_cursor: hasMore ? String(offset + PAGE) : null });
}
