import { json, error } from '../../lib/http.js';
import { requireAdmin } from '../../lib/admin.js';

// GET /api/admin/users/:handle — account detail + moderation history for the
// Users section of the admin panel.
export async function onRequestGet(context) {
  const g = requireAdmin(context);
  if (g.fail) return g.fail;

  let handle = String(context.params.handle || '').trim().toLowerCase();
  if (handle.startsWith('@')) handle = handle.slice(1);

  const u = await context.env.DB.prepare(
    `SELECT id, email, handle, display_name, name, plan, is_admin,
            board_blocked_at, disabled_at, created_at
       FROM users WHERE handle = ?`
  )
    .bind(handle)
    .first();
  if (!u) return error(404, 'No such account');

  const [counts, { results: history }] = await Promise.all([
    context.env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM project_listings l JOIN projects p ON p.id = l.project_id
           WHERE p.owner_id = ?1) AS listings,
         (SELECT COUNT(*) FROM listing_comments WHERE user_id = ?1 AND deleted_at IS NULL) AS comments,
         (SELECT COUNT(*) FROM contributor_requests WHERE requester_id = ?1) AS requests,
         (SELECT COUNT(*) FROM reports WHERE reporter_id = ?1) AS reports_filed`
    )
      .bind(u.id)
      .first(),
    context.env.DB.prepare(
      `SELECT m.id, m.action, m.note, m.created_at, m.report_id,
              a.handle AS admin_handle, a.display_name AS admin_display_name, a.name AS admin_name
         FROM moderation_actions m
         LEFT JOIN users a ON a.id = m.admin_id
        WHERE m.target_user_id = ?
        ORDER BY m.created_at DESC LIMIT 100`
    )
      .bind(u.id)
      .all(),
  ]);

  return json({
    user: {
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
    },
    counts,
    history: (history || []).map((m) => ({
      id: m.id,
      action: m.action,
      note: m.note,
      created_at: m.created_at,
      report_id: m.report_id,
      admin: {
        handle: m.admin_handle,
        display_name: m.admin_display_name,
        name: m.admin_name,
      },
    })),
  });
}
