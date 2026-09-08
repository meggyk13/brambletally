import { json, error } from '../../lib/http.js';
import { uuid } from '../../lib/id.js';
import { requireProject } from '../../lib/projects.js';

// POST /api/projects/:id/duplicate — copy a project the caller can see into a
// new project they own. Copies steps (incl. sub-steps), supplies, and links;
// resets completion / acquired state. Does NOT copy the journal, collaborators,
// any board listing, or planned focus sessions.
export async function onRequestPost(context) {
  const { id } = context.params;
  const g = await requireProject(context, id, 'viewer');
  if (g.fail) return g.fail;

  const db = context.env.DB;
  const me = g.user;

  const src = await db.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first();
  if (!src) return error(404, 'Project not found');

  const [steps, supplies, links] = await Promise.all([
    db
      .prepare('SELECT * FROM project_steps WHERE project_id = ? ORDER BY sort_order, created_at')
      .bind(id)
      .all()
      .then((r) => r.results),
    db.prepare('SELECT * FROM project_supplies WHERE project_id = ?').bind(id).all().then((r) => r.results),
    db
      .prepare('SELECT * FROM project_links WHERE project_id = ? ORDER BY sort_order, created_at')
      .bind(id)
      .all()
      .then((r) => r.results),
  ]);

  const newId = uuid();
  const stmts = [
    db
      .prepare(
        `INSERT INTO projects (id, owner_id, category, title, description, status, deadline, pickup_note)
         VALUES (?, ?, ?, ?, ?, 'Active', NULL, ?)`
      )
      .bind(newId, me.id, src.category || null, `${src.title} (copy)`, src.description || null, src.pickup_note || null),
    db
      .prepare("INSERT INTO project_collaborators (project_id, user_id, role) VALUES (?, ?, 'owner')")
      .bind(newId, me.id),
  ];

  // Make sure the copied category name shows up in the new owner's picker.
  if (src.category) {
    stmts.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO categories (id, user_id, name, sort_order)
           VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM categories WHERE user_id = ?))`
        )
        .bind(uuid(), me.id, src.category, me.id)
    );
  }

  // Steps: remap ids so parent_step_id points at the new rows. Parents first so
  // the self-FK holds inside the batch. Completion is reset; assignee dropped
  // (collaborators aren't copied).
  const idMap = new Map(steps.map((s) => [s.id, uuid()]));
  const ordered = [
    ...steps.filter((s) => !s.parent_step_id),
    ...steps.filter((s) => s.parent_step_id),
  ];
  for (const s of ordered) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO project_steps
             (id, project_id, parent_step_id, title, completed, completed_at, due_date, notes,
              estimate_minutes, assignee_id, sort_order)
           VALUES (?, ?, ?, ?, 0, NULL, ?, ?, ?, NULL, ?)`
        )
        .bind(
          idMap.get(s.id),
          newId,
          s.parent_step_id ? idMap.get(s.parent_step_id) : null,
          s.title,
          s.due_date || null,
          s.notes || null,
          s.estimate_minutes ?? null,
          s.sort_order ?? 0
        )
    );
  }

  for (const su of supplies) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO project_supplies (id, project_id, name, acquired, cost, source, url)
           VALUES (?, ?, ?, 0, ?, ?, ?)`
        )
        .bind(uuid(), newId, su.name, su.cost ?? null, su.source || null, su.url || null)
    );
  }

  for (const li of links) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO project_links (id, project_id, url, title, note, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(uuid(), newId, li.url, li.title || null, li.note || null, li.sort_order ?? 0)
    );
  }

  await db.batch(stmts);

  return json({ id: newId }, { status: 201 });
}
