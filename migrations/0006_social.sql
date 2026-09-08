-- 0006_social.sql
-- Social Phase 1b-ii PR 2: user-to-user blocking. A block hides both accounts
-- from each other in user search, the People search section, profile views, and
-- the interest-discovery list. Deleting the reciprocal `follows` rows is wired
-- in with Phase 2 (the follows table doesn't exist yet).
--
-- Apply (local dev sqlite file):
--   npx wrangler d1 execute brambletally --local --file=./migrations/0006_social.sql
-- Apply (production):
--   npx wrangler d1 execute brambletally --remote --file=./migrations/0006_social.sql

CREATE TABLE user_blocks (
  blocker_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (blocker_id, blocked_id)
);
CREATE INDEX idx_blocks_blocked ON user_blocks(blocked_id);
