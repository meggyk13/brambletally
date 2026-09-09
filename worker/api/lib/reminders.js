import { notify } from './notify.js';
import { readNotifPrefs } from './notif.js';
import { DEFAULT_TZ } from './constants.js';

// Local calendar date (YYYY-MM-DD) `days` from now, in IANA zone `tz`.
// en-CA formats as YYYY-MM-DD.
function localDate(tz, days = 0) {
  const d = new Date(Date.now() + days * 86400000);
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz || DEFAULT_TZ }).format(d);
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: DEFAULT_TZ }).format(d);
  }
}

// Daily cron. Writes a `step_due` notification for each open leaf step that is
// due today or tomorrow in the recipient's local time. Assigned steps notify
// the assignee; unassigned steps notify the project owner + editors. Deduped by
// (recipient, step, due_date) so a step re-reminds only when its date changes.
// notify() decides email: immediate-mode users get it now, weekly-mode users
// pick it up in Sunday's digest, off-mode users get the in-app row only.
export async function runDueReminders(env, ctx) {
  const context = { env, waitUntil: ctx && ctx.waitUntil ? ctx.waitUntil.bind(ctx) : null };

  // Candidate steps, roughly windowed in UTC; the exact local today/tomorrow
  // test happens per recipient below (timezone is per user).
  const { results: rows } = await env.DB.prepare(
    `SELECT s.id AS step_id, s.title, s.due_date, s.assignee_id, p.id AS project_id
       FROM project_steps s
       JOIN projects p ON p.id = s.project_id
      WHERE s.completed = 0
        AND s.due_date IS NOT NULL
        AND p.archived_at IS NULL
        AND p.status IN ('Active', 'Waiting For')
        AND s.id NOT IN (SELECT parent_step_id FROM project_steps WHERE parent_step_id IS NOT NULL)
        AND s.due_date >= date('now', '-2 days')
        AND s.due_date <= date('now', '+2 days')`
  ).all();

  if (!rows.length) return { considered: 0, written: 0 };

  // owner + editors per project (recipients for unassigned steps)
  const projIds = [...new Set(rows.map((r) => r.project_id))];
  const { results: collabs } = await env.DB.prepare(
    `SELECT project_id, user_id FROM project_collaborators
      WHERE role IN ('owner', 'editor')
        AND project_id IN (${projIds.map(() => '?').join(',')})`
  )
    .bind(...projIds)
    .all();
  const editorsByProj = new Map();
  for (const c of collabs) {
    if (!editorsByProj.has(c.project_id)) editorsByProj.set(c.project_id, []);
    editorsByProj.get(c.project_id).push(c.user_id);
  }

  // timezone for every possible recipient
  const recipIds = new Set();
  for (const r of rows) {
    if (r.assignee_id) recipIds.add(r.assignee_id);
    else (editorsByProj.get(r.project_id) || []).forEach((u) => recipIds.add(u));
  }
  const tzById = new Map();
  const dueOffById = new Map(); // users who turned the step_due type off
  if (recipIds.size) {
    const ids = [...recipIds];
    const { results: us } = await env.DB.prepare(
      `SELECT u.id, u.timezone, p.notif_prefs
         FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id
        WHERE u.id IN (${ids.map(() => '?').join(',')})`
    )
      .bind(...ids)
      .all();
    for (const u of us) {
      tzById.set(u.id, u.timezone);
      if (readNotifPrefs(u.notif_prefs).types.step_due === false) dueOffById.set(u.id, true);
    }
  }

  let written = 0;
  for (const r of rows) {
    const recipients = r.assignee_id ? [r.assignee_id] : editorsByProj.get(r.project_id) || [];
    for (const uid of recipients) {
      if (dueOffById.has(uid)) continue;
      const tz = tzById.get(uid) || DEFAULT_TZ;
      if (r.due_date !== localDate(tz, 0) && r.due_date !== localDate(tz, 1)) continue;

      // Dedup key folds the due date in so a reschedule re-reminds.
      const subjectId = `${r.step_id}:${r.due_date}`;
      const dup = await env.DB.prepare(
        `SELECT 1 FROM notifications
          WHERE user_id = ? AND type = 'step_due' AND subject_id = ? LIMIT 1`
      )
        .bind(uid, subjectId)
        .first();
      if (dup) continue;

      await notify(context, {
        recipientId: uid,
        actorId: null,
        type: 'step_due',
        subjectType: 'step',
        subjectId,
        preview: r.title,
      });
      written++;
    }
  }

  console.log(`[brambletally] due reminders: ${written} written from ${rows.length} candidate step(s)`);
  return { considered: rows.length, written };
}
