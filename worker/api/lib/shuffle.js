// Shuffle tool: candidate "boxes" (outstanding gaps) across projects, steps,
// and inbox items, plus the weighted-random draw. See docs/plan.md, "Planned:
// Shuffle — the Inbox rebrand".

export const SHUFFLE_KINDS = [
  'inbox_unsorted',
  'project_no_category',
  'project_no_deadline',
  'project_no_description',
  'project_no_steps',
  'project_next_step_no_note',
  'project_looks_done',
];

// Validates shape (a known kind + a non-empty opaque id), not the id format
// itself — real ids are uuid()s, but dev fixtures use short hand-picked ones.
export const BOX_KEY_RE = new RegExp(`^(${SHUFFLE_KINDS.join('|')}):[^:]+$`);

// A leaf step: one with no sub-steps of its own. Containers derive their
// state from children and don't carry their own next-action.
const LEAF = `s.id NOT IN (SELECT parent_step_id FROM project_steps WHERE parent_step_id IS NOT NULL)`;

// Hours since an anchor timestamp — SQLite julianday keeps this timezone-safe
// without parsing "YYYY-MM-DD HH:MM:SS" strings in JS.
const HOURS_SINCE = (col) => `(julianday('now') - julianday(${col})) * 24`;
const DAYS_SINCE_SHOWN = `CASE WHEN ss.last_shown_at IS NULL THEN NULL
                               ELSE julianday('now') - julianday(ss.last_shown_at) END`;
const NOT_HIDDEN = `(ss.dismissed_at IS NULL)
  AND (ss.snoozed_until IS NULL OR ss.snoozed_until <= datetime('now'))`;

const shapeProject = (row) => ({
  id: row.project_id,
  title: row.title,
  category: row.category,
  deadline: row.deadline,
  description: row.description,
  status: row.status,
  role: row.role,
});

async function all(db, sql, ...binds) {
  return (await db.prepare(sql).bind(...binds).all()).results;
}

// Every outstanding box for this user, across their owned/editable projects
// and their own inbox. Each candidate carries enough to score it (hours_since,
// days_since_shown) and enough to render it (card).
export async function fetchCandidates(db, userId) {
  const out = [];

  for (const row of await all(
    db,
    `SELECT 'inbox_unsorted:' || i.id AS box_key, i.id, i.text,
            ${HOURS_SINCE('i.created_at')} AS hours_since, ${DAYS_SINCE_SHOWN} AS days_since_shown
       FROM inbox_items i
       LEFT JOIN shuffle_state ss ON ss.user_id = i.user_id AND ss.box_key = 'inbox_unsorted:' || i.id
      WHERE i.user_id = ? AND ${NOT_HIDDEN}`,
    userId
  )) {
    out.push({
      box_key: row.box_key,
      kind: 'inbox_unsorted',
      hours_since: row.hours_since,
      days_since_shown: row.days_since_shown,
      card: { inbox_item: { id: row.id, text: row.text } },
    });
  }

  const PROJECT_COLS =
    'p.id AS project_id, p.title, p.category, p.deadline, p.description, p.status, pc.role';

  const noCategory = await all(
    db,
    `SELECT 'project_no_category:' || p.id AS box_key, ${PROJECT_COLS},
            ${HOURS_SINCE('p.updated_at')} AS hours_since, ${DAYS_SINCE_SHOWN} AS days_since_shown
       FROM projects p
       JOIN project_collaborators pc ON pc.project_id = p.id AND pc.user_id = ? AND pc.role IN ('owner','editor')
       LEFT JOIN shuffle_state ss ON ss.user_id = ? AND ss.box_key = 'project_no_category:' || p.id
      WHERE p.archived_at IS NULL AND p.category IS NULL AND p.status != 'Done' AND ${NOT_HIDDEN}`,
    userId,
    userId
  );
  for (const row of noCategory) {
    out.push({
      box_key: row.box_key,
      kind: 'project_no_category',
      hours_since: row.hours_since,
      days_since_shown: row.days_since_shown,
      card: { project: shapeProject(row) },
    });
  }

  const noDeadline = await all(
    db,
    `SELECT 'project_no_deadline:' || p.id AS box_key, ${PROJECT_COLS},
            ${HOURS_SINCE('p.updated_at')} AS hours_since, ${DAYS_SINCE_SHOWN} AS days_since_shown
       FROM projects p
       JOIN project_collaborators pc ON pc.project_id = p.id AND pc.user_id = ? AND pc.role IN ('owner','editor')
       LEFT JOIN shuffle_state ss ON ss.user_id = ? AND ss.box_key = 'project_no_deadline:' || p.id
      WHERE p.archived_at IS NULL AND p.deadline IS NULL
        AND p.status IN ('Active','Waiting For') AND ${NOT_HIDDEN}`,
    userId,
    userId
  );
  for (const row of noDeadline) {
    out.push({
      box_key: row.box_key,
      kind: 'project_no_deadline',
      hours_since: row.hours_since,
      days_since_shown: row.days_since_shown,
      card: { project: shapeProject(row) },
    });
  }

  const noDescription = await all(
    db,
    `SELECT 'project_no_description:' || p.id AS box_key, ${PROJECT_COLS},
            ${HOURS_SINCE('p.updated_at')} AS hours_since, ${DAYS_SINCE_SHOWN} AS days_since_shown
       FROM projects p
       JOIN project_collaborators pc ON pc.project_id = p.id AND pc.user_id = ? AND pc.role IN ('owner','editor')
       LEFT JOIN shuffle_state ss ON ss.user_id = ? AND ss.box_key = 'project_no_description:' || p.id
      WHERE p.archived_at IS NULL AND (p.description IS NULL OR p.description = '')
        AND p.status != 'Done' AND ${NOT_HIDDEN}`,
    userId,
    userId
  );
  for (const row of noDescription) {
    out.push({
      box_key: row.box_key,
      kind: 'project_no_description',
      hours_since: row.hours_since,
      days_since_shown: row.days_since_shown,
      card: { project: shapeProject(row) },
    });
  }

  const noSteps = await all(
    db,
    `SELECT 'project_no_steps:' || p.id AS box_key, ${PROJECT_COLS},
            ${HOURS_SINCE('p.updated_at')} AS hours_since, ${DAYS_SINCE_SHOWN} AS days_since_shown
       FROM projects p
       JOIN project_collaborators pc ON pc.project_id = p.id AND pc.user_id = ? AND pc.role IN ('owner','editor')
       LEFT JOIN shuffle_state ss ON ss.user_id = ? AND ss.box_key = 'project_no_steps:' || p.id
      WHERE p.archived_at IS NULL AND p.status = 'Active'
        AND NOT EXISTS (SELECT 1 FROM project_steps s WHERE s.project_id = p.id AND ${LEAF})
        AND ${NOT_HIDDEN}`,
    userId,
    userId
  );
  for (const row of noSteps) {
    out.push({
      box_key: row.box_key,
      kind: 'project_no_steps',
      hours_since: row.hours_since,
      days_since_shown: row.days_since_shown,
      card: { project: shapeProject(row) },
    });
  }

  // Keyed by the *step*, not the project — so if the next open step changes,
  // it's a fresh box, and a dismiss on one step doesn't silence the next one.
  const nextStepNoNote = await all(
    db,
    `SELECT 'project_next_step_no_note:' || s.id AS box_key, ${PROJECT_COLS},
            s.id AS step_id, s.title AS step_title, s.notes AS step_notes,
            ${HOURS_SINCE('p.updated_at')} AS hours_since, ${DAYS_SINCE_SHOWN} AS days_since_shown
       FROM projects p
       JOIN project_collaborators pc ON pc.project_id = p.id AND pc.user_id = ? AND pc.role IN ('owner','editor')
       JOIN project_steps s ON s.project_id = p.id AND s.completed = 0 AND ${LEAF}
        AND s.id = (
          SELECT s2.id FROM project_steps s2
           WHERE s2.project_id = p.id AND s2.completed = 0
             AND s2.id NOT IN (SELECT parent_step_id FROM project_steps WHERE parent_step_id IS NOT NULL)
           ORDER BY s2.sort_order, s2.created_at LIMIT 1
        )
       LEFT JOIN shuffle_state ss ON ss.user_id = ? AND ss.box_key = 'project_next_step_no_note:' || s.id
      WHERE p.archived_at IS NULL AND p.status = 'Active'
        AND (s.notes IS NULL OR s.notes = '') AND ${NOT_HIDDEN}`,
    userId,
    userId
  );
  for (const row of nextStepNoNote) {
    out.push({
      box_key: row.box_key,
      kind: 'project_next_step_no_note',
      hours_since: row.hours_since,
      days_since_shown: row.days_since_shown,
      card: {
        project: shapeProject(row),
        step: { id: row.step_id, title: row.step_title, notes: row.step_notes },
      },
    });
  }

  const looksDone = await all(
    db,
    `SELECT 'project_looks_done:' || p.id AS box_key, ${PROJECT_COLS},
            ${HOURS_SINCE('p.updated_at')} AS hours_since, ${DAYS_SINCE_SHOWN} AS days_since_shown
       FROM projects p
       JOIN project_collaborators pc ON pc.project_id = p.id AND pc.user_id = ? AND pc.role IN ('owner','editor')
       LEFT JOIN shuffle_state ss ON ss.user_id = ? AND ss.box_key = 'project_looks_done:' || p.id
      WHERE p.archived_at IS NULL AND p.status = 'Active'
        AND EXISTS (SELECT 1 FROM project_steps s WHERE s.project_id = p.id AND ${LEAF})
        AND NOT EXISTS (SELECT 1 FROM project_steps s WHERE s.project_id = p.id AND s.completed = 0 AND ${LEAF})
        AND ${NOT_HIDDEN}`,
    userId,
    userId
  );
  for (const row of looksDone) {
    out.push({
      box_key: row.box_key,
      kind: 'project_looks_done',
      hours_since: row.hours_since,
      days_since_shown: row.days_since_shown,
      card: { project: shapeProject(row) },
    });
  }

  return out;
}

// Recent ~= 1, ~2-day half-life. Never-shown gets the max staleness boost
// immediately; anything else climbs back to that ceiling over a week — so
// nothing sits forever just because it's old and rarely touched.
export function pickWeighted(candidates) {
  if (!candidates.length) return null;
  let total = 0;
  const weighted = candidates.map((c) => {
    const recency = 1 / (1 + Math.max(c.hours_since, 0) / 48);
    const staleness = c.days_since_shown == null ? 3 : Math.min(c.days_since_shown / 7, 3);
    const weight = recency + staleness;
    total += weight;
    return { c, weight };
  });
  let r = Math.random() * total;
  for (const { c, weight } of weighted) {
    r -= weight;
    if (r <= 0) return c;
  }
  return weighted[weighted.length - 1].c;
}
