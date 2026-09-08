import { json, error, readJson } from '../lib/http.js';
import { requireProject } from '../lib/projects.js';
import { STATUSES, pick, isNonEmptyString } from '../lib/validate.js';
import { shapeSession, SESSION_SELECT, SESSION_JOINS } from '../lib/worksessions.js';

// GET /api/projects/:id — full bundle for the detail view.
export async function onRequestGet(context) {
  const { id } = context.params;
  const g = await requireProject(context, id, 'viewer');
  if (g.fail) return g.fail;

  const db = context.env.DB;
  const project = await db.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first();
  const steps = (await db.prepare(
    'SELECT * FROM project_steps WHERE project_id = ? ORDER BY sort_order, created_at'
  ).bind(id).all()).results;
  const supplies = (await db.prepare(
    'SELECT * FROM project_supplies WHERE project_id = ? ORDER BY created_at'
  ).bind(id).all()).results;
  const links = (await db.prepare(
    'SELECT * FROM project_links WHERE project_id = ? ORDER BY sort_order, created_at'
  ).bind(id).all()).results;
  const journal = (await db.prepare(
    `SELECT j.*, u.name AS author_name
       FROM project_journal j JOIN users u ON u.id = j.user_id
      WHERE j.project_id = ? ORDER BY j.created_at DESC`
  ).bind(id).all()).results;
  const collaborators = (await db.prepare(
    `SELECT pc.user_id, pc.role, pc.added_at, u.name, u.email
       FROM project_collaborators pc JOIN users u ON u.id = pc.user_id
      WHERE pc.project_id = ? ORDER BY pc.added_at`
  ).bind(id).all()).results;
  const listing = await db
    .prepare('SELECT id, status FROM project_listings WHERE project_id = ?')
    .bind(id)
    .first();
  const sessions = (
    await db
      .prepare(
        `SELECT ${SESSION_SELECT}
           FROM work_sessions ws ${SESSION_JOINS}
          WHERE ws.project_id = ? AND ws.ends_at > datetime('now', '-1 day')
          ORDER BY ws.starts_at`
      )
      .bind(id)
      .all()
  ).results;

  return json({
    project: { ...project, role: g.role },
    steps,
    supplies,
    links,
    journal,
    collaborators,
    listing: listing || null, // { id, status } when this project is on the board
    sessions: (sessions || []).map((r) => shapeSession(r, g.user.id)),
  });
}

// PATCH /api/projects/:id — editors and up.
export async function onRequestPatch(context) {
  const { id } = context.params;
  const g = await requireProject(context, id, 'editor');
  if (g.fail) return g.fail;

  const body = await readJson(context.request);
  if (!body) return error(400, 'Body required');

  const db = context.env.DB;

  // Archive / unarchive rides on the same PATCH but is owner-only, and archiving
  // also closes an open board listing so a shelved project stops asking for help.
  if ('archived' in body) {
    if (g.role !== 'owner') return error(403, 'Only the owner can archive a project');
    const archived = !!body.archived;
    const stmts = [
      db
        .prepare(
          `UPDATE projects SET archived_at = ${archived ? "datetime('now')" : 'NULL'},
                  updated_at = datetime('now') WHERE id = ?`
        )
        .bind(id),
    ];
    if (archived) {
      stmts.push(
        db
          .prepare(
            `UPDATE project_listings SET status = 'closed', updated_at = datetime('now')
              WHERE project_id = ? AND status = 'open'`
          )
          .bind(id)
      );
    }
    await db.batch(stmts);
  }

  const fields = pick(body, ['title', 'description', 'status', 'deadline', 'category', 'pickup_note']);
  if ('title' in fields && !isNonEmptyString(fields.title)) return error(400, 'Title cannot be empty');
  if ('title' in fields) fields.title = fields.title.trim();
  if ('status' in fields && !STATUSES.includes(fields.status)) return error(400, 'Invalid status');
  if ('category' in fields) {
    fields.category =
      typeof fields.category === 'string' && fields.category.trim() ? fields.category.trim() : null;
  }

  if (Object.keys(fields).length === 0) {
    if ('archived' in body) {
      const project = await db.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first();
      return json({ project: { ...project, role: g.role } });
    }
    return error(400, 'Nothing to update');
  }

  const cols = Object.keys(fields);
  const set = cols.map((c) => `${c} = ?`).join(', ');
  await db
    .prepare(`UPDATE projects SET ${set}, updated_at = datetime('now') WHERE id = ?`)
    .bind(...cols.map((c) => fields[c]), id)
    .run();

  const project = await db.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first();
  return json({ project: { ...project, role: g.role } });
}

// DELETE /api/projects/:id — owner only. Children cascade.
export async function onRequestDelete(context) {
  const { id } = context.params;
  const g = await requireProject(context, id, 'owner');
  if (g.fail) return g.fail;

  await context.env.DB.prepare('DELETE FROM projects WHERE id = ?').bind(id).run();
  return json({ ok: true });
}
