import { json } from '../lib/http.js';
import { requireAdmin } from '../lib/admin.js';
import { DELETED_USER_ID } from '../lib/constants.js';

// GET /api/admin/stats — at-a-glance counts for the Admin panel's Overview
// tab. The permanent deleted-user placeholder (migration 0018) is excluded
// from every users(...) count so it doesn't skew the numbers by one.
export async function onRequestGet(context) {
  const g = requireAdmin(context);
  if (g.fail) return g.fail;

  const row = await context.env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE id != ?1) AS users_total,
       (SELECT COUNT(*) FROM users WHERE id != ?1 AND email IS NULL) AS users_anonymous,
       (SELECT COUNT(*) FROM users WHERE plan = 'supporter') AS users_supporter,
       (SELECT COUNT(*) FROM users WHERE id != ?1 AND is_admin = 1) AS users_admin,
       (SELECT COUNT(*) FROM users WHERE id != ?1 AND created_at >= datetime('now', '-7 days')) AS signups_7d,
       (SELECT COUNT(*) FROM users WHERE board_blocked_at IS NOT NULL) AS users_board_blocked,
       (SELECT COUNT(*) FROM users WHERE id != ?1 AND disabled_at IS NOT NULL) AS users_disabled,
       (SELECT COUNT(*) FROM reports WHERE status = 'open') AS reports_open,
       (SELECT COUNT(*) FROM project_listings WHERE status = 'open') AS listings_open,
       (SELECT COUNT(*) FROM project_listings WHERE status = 'closed') AS listings_closed,
       (SELECT COUNT(*) FROM project_listings WHERE status = 'archived') AS listings_archived,
       (SELECT COUNT(*) FROM moderation_actions WHERE created_at >= datetime('now', '-7 days')) AS mod_actions_7d
    `
  )
    .bind(DELETED_USER_ID)
    .first();

  return json({ stats: row });
}
