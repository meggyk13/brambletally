// Shared helpers for planned focus time (work_sessions).

export const WS_STATUSES = ['planned', 'done', 'skipped'];
export const NOTE_MAX = 500;

// Normalise a client-supplied datetime to the "YYYY-MM-DD HH:MM:SS" UTC shape
// that SQLite's datetime('now') emits, so range comparisons in SQL stay string-
// safe. Accepts anything Date can parse (ISO with offset, "Z", etc). -> null on
// junk.
export function toSqlDatetime(v) {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}

// Row -> client shape. `meId` decides `is_mine` (only the planner can edit it).
export const shapeSession = (row, meId) => ({
  id: row.id,
  project_id: row.project_id,
  project_title: row.project_title || null,
  step_id: row.step_id,
  step_title: row.step_title || null,
  starts_at: row.starts_at,
  ends_at: row.ends_at,
  note: row.note,
  status: row.status,
  planner: {
    name: row.planner_name || null,
    handle: row.planner_handle || null,
    display_name: row.planner_display_name || null,
  },
  is_mine: row.user_id === meId,
});

// SELECT column list + joins for a fully-shaped session row. Alias the table as
// `ws`.
export const SESSION_SELECT = `
  ws.id, ws.user_id, ws.project_id, ws.step_id, ws.starts_at, ws.ends_at,
  ws.note, ws.status,
  p.title AS project_title,
  st.title AS step_title,
  pl.name AS planner_name, pl.handle AS planner_handle, pl.display_name AS planner_display_name`;

export const SESSION_JOINS = `
  JOIN projects p ON p.id = ws.project_id
  JOIN users pl ON pl.id = ws.user_id
  LEFT JOIN project_steps st ON st.id = ws.step_id`;
