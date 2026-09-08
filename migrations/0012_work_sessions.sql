-- 0012_work_sessions.sql
-- Planned focus time: a work_session is one collaborator's intention to work on
-- a project (optionally a specific step) in a given time window. Each
-- collaborator plans their own; editor+ on the project to create.
--
-- users.calendar_token keys the per-user ICS subscription feed
-- (GET /api/calendar/<token>.ics) — no cookie, the token is the secret.
--
-- Apply (local dev sqlite file):
--   npx wrangler d1 execute brambletally --local --file=./migrations/0012_work_sessions.sql
-- Apply (production):
--   npx wrangler d1 execute brambletally --remote --file=./migrations/0012_work_sessions.sql

CREATE TABLE work_sessions (
  id          TEXT PRIMARY KEY,               -- uuid
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  step_id     TEXT REFERENCES project_steps(id) ON DELETE SET NULL,  -- optional
  starts_at   TEXT NOT NULL,                  -- "YYYY-MM-DD HH:MM:SS" UTC, like datetime('now')
  ends_at     TEXT NOT NULL,
  note        TEXT,                           -- optional, <= 500
  status      TEXT NOT NULL DEFAULT 'planned'
                CHECK(status IN ('planned','done','skipped')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_work_sessions_user ON work_sessions(user_id, starts_at);
CREATE INDEX idx_work_sessions_project ON work_sessions(project_id, starts_at);

ALTER TABLE users ADD COLUMN calendar_token TEXT;
CREATE UNIQUE INDEX idx_users_calendar_token
  ON users(calendar_token) WHERE calendar_token IS NOT NULL;
