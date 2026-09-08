-- 0003_social.sql
-- Social Phase 1a — identity columns on users: a unique @handle, a free-text
-- display name, an admin flag, the ToS acceptance stamp (used in Phase 1b), and
-- the two sanction timestamps. Only disabled_at has an enforcement path in 1a
-- (the router 403s a disabled account); the rest are wired as later phases land.
--
-- Apply (local dev sqlite file):
--   npx wrangler d1 execute brambletally --local --file=./migrations/0003_social.sql
-- Apply (production):
--   npx wrangler d1 execute brambletally --remote --file=./migrations/0003_social.sql

ALTER TABLE users ADD COLUMN handle        TEXT;    -- 3-20 [a-z0-9_], case-folded; UNIQUE via the partial index below
ALTER TABLE users ADD COLUMN handle_set_at TEXT;    -- ISO datetime of the last handle write; drives the 30-day change cooldown
ALTER TABLE users ADD COLUMN display_name  TEXT;    -- free text, <= 50; UI falls back to @handle
ALTER TABLE users ADD COLUMN is_admin      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN tos_accepted_at TEXT;  -- set at the first-login acceptance gate (Phase 1b)
ALTER TABLE users ADD COLUMN tos_version     TEXT;
ALTER TABLE users ADD COLUMN board_blocked_at TEXT; -- soft sanction: no board posting (nothing to guard until Phase 3)
ALTER TABLE users ADD COLUMN disabled_at      TEXT; -- hard sanction: the router 403s everything but /api/auth/me + logout

CREATE UNIQUE INDEX idx_users_handle ON users(handle) WHERE handle IS NOT NULL;
