import { json } from '../../lib/http.js';
import { requireAdmin } from '../../lib/admin.js';
import { DELETED_USER_ID } from '../../lib/constants.js';

const PAGE = 50;
const FILTERS = {
  admin: 'is_admin = 1',
  supporter: "plan = 'supporter'",
  board_blocked: 'board_blocked_at IS NOT NULL',
  disabled: 'disabled_at IS NOT NULL',
};

// GET /api/admin/users?cursor=&filter=&q= — every account (the deleted-user
// placeholder excluded), newest first, for the Users tab's browsable list.
// Detail/sanction actions stay handle-keyed (GET/POST .../users/:handle) —
// a row with no handle set yet shows up here but isn't clickable into detail.
export async function onRequestGet(context) {
  const g = requireAdmin(context);
  if (g.fail) return g.fail;

  const params = new URL(context.request.url).searchParams;
  const offset = Math.max(0, parseInt(params.get('cursor') || '0', 10) || 0);
  const filter = params.get('filter');
  const q = (params.get('q') || '').trim().toLowerCase();

  const conds = ['id != ?'];
  const binds = [DELETED_USER_ID];
  if (FILTERS[filter]) conds.push(FILTERS[filter]);
  if (q) {
    conds.push(
      `(lower(COALESCE(handle, '')) LIKE ? OR lower(COALESCE(display_name, '')) LIKE ?
        OR lower(COALESCE(name, '')) LIKE ? OR lower(COALESCE(email, '')) LIKE ?)`
    );
    const like = `%${q}%`;
    binds.push(like, like, like, like);
  }

  const { results } = await context.env.DB.prepare(
    `SELECT id, email, handle, display_name, name, plan, is_admin,
            board_blocked_at, disabled_at, created_at
       FROM users
      WHERE ${conds.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?`
  )
    .bind(...binds, PAGE + 1, offset)
    .all();

  const hasMore = results.length > PAGE;
  const users = results.slice(0, PAGE).map((u) => ({
    id: u.id,
    email: u.email,
    handle: u.handle,
    display_name: u.display_name,
    name: u.name,
    plan: u.plan,
    is_admin: !!u.is_admin,
    board_blocked_at: u.board_blocked_at,
    disabled_at: u.disabled_at,
    created_at: u.created_at,
  }));

  return json({ users, next_cursor: hasMore ? String(offset + PAGE) : null });
}
