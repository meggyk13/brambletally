import { json, error, readJson } from '../../lib/http.js';
import { uuid } from '../../lib/id.js';
import { requireAdmin } from '../../lib/admin.js';
import { trimOrNull } from '../../lib/validate.js';

// PATCH /api/admin/reports/:reportId — { status: 'actioned'|'dismissed', note?, removed? }.
// The panel deletes reported content first (via the existing owner-or-admin board
// DELETE); pass `removed: true` here to also log a `content_removed` moderation
// action against the target's author.
export async function onRequestPatch(context) {
  const g = requireAdmin(context);
  if (g.fail) return g.fail;
  const me = g.user;
  const { reportId } = context.params;

  const body = await readJson(context.request);
  const status = body && body.status;
  if (status !== 'actioned' && status !== 'dismissed')
    return error(400, "status must be 'actioned' or 'dismissed'");
  const note = trimOrNull(body && body.note, 1000);

  const report = await context.env.DB.prepare('SELECT * FROM reports WHERE id = ?')
    .bind(reportId)
    .first();
  if (!report) return error(404, 'Report not found');

  const stmts = [
    context.env.DB.prepare(
      `UPDATE reports
          SET status = ?, resolved_by = ?, resolved_at = datetime('now'), resolution_note = ?
        WHERE id = ?`
    ).bind(status, me.id, note, reportId),
  ];

  if (body && body.removed && status === 'actioned') {
    // Resolve the target's author (loose ref — may be gone already).
    let authorId = null;
    if (report.target_type === 'listing') {
      const r = await context.env.DB.prepare(
        `SELECT p.owner_id FROM project_listings l JOIN projects p ON p.id = l.project_id
          WHERE l.id = ?`
      )
        .bind(report.target_id)
        .first();
      authorId = r && r.owner_id;
    } else if (report.target_type === 'comment') {
      const r = await context.env.DB.prepare('SELECT user_id FROM listing_comments WHERE id = ?')
        .bind(report.target_id)
        .first();
      authorId = r && r.user_id;
    } else {
      authorId = report.target_id; // profile target_id is the user id
    }
    if (authorId) {
      stmts.push(
        context.env.DB.prepare(
          `INSERT INTO moderation_actions (id, admin_id, target_user_id, report_id, action, note)
           VALUES (?, ?, ?, ?, 'content_removed', ?)`
        ).bind(uuid(), me.id, authorId, reportId, note)
      );
    }
  }

  await context.env.DB.batch(stmts);
  return json({ ok: true, status });
}
