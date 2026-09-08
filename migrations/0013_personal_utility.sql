-- 0013_personal_utility.sql
-- Personal-utility batch (docs/plan.md -> "Planned: personal-utility batch +
-- project export + category rework"). Three independent additive columns:
--   B  users.timezone          IANA name; NULL falls back to DEFAULT_TZ
--   F  projects.archived_at     ISO datetime; NULL = active (orthogonal to status)
--   G  project_steps.assignee_id  one collaborator per step; NULL = unassigned
--
-- Apply (local dev sqlite file):
--   npx wrangler d1 execute brambletally --local --file=./migrations/0013_personal_utility.sql
-- Apply (production):
--   npx wrangler d1 execute brambletally --remote --file=./migrations/0013_personal_utility.sql

ALTER TABLE users    ADD COLUMN timezone    TEXT;   -- IANA name e.g. 'America/Los_Angeles'; NULL = DEFAULT_TZ
ALTER TABLE projects ADD COLUMN archived_at TEXT;   -- ISO datetime; NULL = not archived

-- assignee_id: like parent_step_id (migration 0001), the ON DELETE action on an
-- ALTER-added FK is not trusted on prod D1 -- the app nulls assignments on
-- collaborator removal, and account deletion is guarded. Fresh installs
-- (schema.sql) get the real FK.
ALTER TABLE project_steps ADD COLUMN assignee_id TEXT
  REFERENCES users(id) ON DELETE SET NULL;          -- NULL = unassigned

CREATE INDEX idx_steps_assignee ON project_steps(assignee_id);
