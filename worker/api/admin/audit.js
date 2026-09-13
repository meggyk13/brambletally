import { json } from '../lib/http.js';
import { requireAdmin } from '../lib/admin.js';

const PAGE = 50;

// Buckets over moderation_actions.action's 7 CHECK values (schema.sql) — a
// chip per exact value would be cluttered; these group into what an admin
// actually wants to isolate.
const GROUPS = {
  board: ['board_block', 'board_unblock'],
  account: ['disable', 'enable'],
  content: ['content_removed'],
  supporter: ['grant_supporter', 'revoke_supporter'],
};

// GET /api/admin/audit?cursor=&group= — every moderation_actions row, any
// admin, any target, newest first. The Users tab's history is the same table
// scoped to one target_user_id; this is the unscoped feed for "what has any
// admin done recently."
export async function onRequestGet(context) {
  const g = requireAdmin(context);
  if (g.fail) return g.fail;

  const params = new URL(context.request.url).searchParams;
  const offset = Math.max(0, parseInt(params.get('cursor') || '0', 10) || 0);
  const actions = GROUPS[params.get('group')];

  const where = actions ? `WHERE m.action IN (${actions.map(() => '?').join(',')})` : '';
  const binds = actions ? [...actions, PAGE + 1, offset] : [PAGE + 1, offset];

  const { results } = await context.env.DB.prepare(
    `SELECT m.id, m.action, m.note, m.created_at, m.report_id,
            a.handle AS admin_handle, a.display_name AS admin_display_name, a.name AS admin_name,
            t.handle AS target_handle, t.display_name AS target_display_name, t.name AS target_name
       FROM moderation_actions m
       LEFT JOIN users a ON a.id = m.admin_id
       LEFT JOIN users t ON t.id = m.target_user_id
       ${where}
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?`
  )
    .bind(...binds)
    .all();

  const hasMore = results.length > PAGE;
  const entries = results.slice(0, PAGE).map((m) => ({
    id: m.id,
    action: m.action,
    note: m.note,
    created_at: m.created_at,
    report_id: m.report_id,
    admin: { handle: m.admin_handle, display_name: m.admin_display_name, name: m.admin_name },
    target: { handle: m.target_handle, display_name: m.target_display_name, name: m.target_name },
  }));

  return json({ entries, next_cursor: hasMore ? String(offset + PAGE) : null });
}
