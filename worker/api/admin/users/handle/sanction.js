import { json, error, readJson } from '../../../lib/http.js';
import { uuid } from '../../../lib/id.js';
import { requireAdmin } from '../../../lib/admin.js';
import { trimOrNull } from '../../../lib/validate.js';

const ACTIONS = {
  board_block: { col: 'board_blocked_at', set: true },
  board_unblock: { col: 'board_blocked_at', set: false },
  disable: { col: 'disabled_at', set: true },
  enable: { col: 'disabled_at', set: false },
};

// POST /api/admin/users/:handle/sanction — { action, note?, reportId? }.
// Both sanctions are reversible timestamps; every call is logged to
// moderation_actions.
export async function onRequestPost(context) {
  const g = requireAdmin(context);
  if (g.fail) return g.fail;
  const me = g.user;

  let handle = String(context.params.handle || '').trim().toLowerCase();
  if (handle.startsWith('@')) handle = handle.slice(1);

  const body = await readJson(context.request);
  const action = body && body.action;
  if (!ACTIONS[action]) return error(400, 'Unknown action');
  const note = trimOrNull(body && body.note, 1000);
  const reportId = body && typeof body.reportId === 'string' ? body.reportId : null;

  const target = await context.env.DB.prepare(
    'SELECT id, is_admin, board_blocked_at, disabled_at FROM users WHERE handle = ?'
  )
    .bind(handle)
    .first();
  if (!target) return error(404, 'No such account');
  if (target.id === me.id) return error(400, 'You can’t sanction yourself');
  if (target.is_admin) return error(403, 'That account is an admin');

  const { col, set } = ACTIONS[action];
  await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE users SET ${col} = ${set ? "datetime('now')" : 'NULL'} WHERE id = ?`
    ).bind(target.id),
    context.env.DB.prepare(
      `INSERT INTO moderation_actions (id, admin_id, target_user_id, report_id, action, note)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(uuid(), me.id, target.id, reportId, action, note),
  ]);

  const updated = await context.env.DB.prepare(
    'SELECT board_blocked_at, disabled_at FROM users WHERE id = ?'
  )
    .bind(target.id)
    .first();
  return json({ ok: true, ...updated });
}
