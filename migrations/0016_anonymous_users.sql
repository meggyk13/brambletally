-- 0016_anonymous_users.sql
-- Anonymous project creation (docs/plan.md "Planned: Guided onboarding +
-- zero-friction account creation", part B). users.email goes from
-- UNIQUE NOT NULL to nullable, partial-unique like handle / calendar_token
-- (schema.sql:11,27-28). SQLite can't drop a column constraint in place;
-- recreate the table (same approach as 0014_supporter_grant.sql).
--
-- Apply (local dev sqlite file):
--   npx wrangler d1 execute brambletally --local --file=./migrations/0016_anonymous_users.sql
-- Apply (production):
--   npx wrangler d1 execute brambletally --remote --file=./migrations/0016_anonymous_users.sql

CREATE TABLE users_new (
  id              TEXT PRIMARY KEY,
  email           TEXT,
  name            TEXT,
  avatar_url      TEXT,
  plan            TEXT NOT NULL DEFAULT 'free',
  handle          TEXT,
  handle_set_at   TEXT,
  display_name    TEXT,
  is_admin        INTEGER NOT NULL DEFAULT 0,
  tos_accepted_at TEXT,
  tos_version     TEXT,
  board_blocked_at TEXT,
  disabled_at     TEXT,
  calendar_token  TEXT,
  timezone        TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO users_new (
  id, email, name, avatar_url, plan, handle, handle_set_at, display_name,
  is_admin, tos_accepted_at, tos_version, board_blocked_at, disabled_at,
  calendar_token, timezone, created_at
)
SELECT
  id, email, name, avatar_url, plan, handle, handle_set_at, display_name,
  is_admin, tos_accepted_at, tos_version, board_blocked_at, disabled_at,
  calendar_token, timezone, created_at
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE UNIQUE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX idx_users_handle ON users(handle) WHERE handle IS NOT NULL;
CREATE UNIQUE INDEX idx_users_calendar_token ON users(calendar_token) WHERE calendar_token IS NOT NULL;
