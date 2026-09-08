-- 0007_social.sql
-- Social Phase 2: following. Asymmetric, no accept step — a follow either
-- exists or it doesn't. A block (user_blocks) deletes any follows row in both
-- directions; POST /api/blocks does that in the same write from now on.
-- The "X started following you" notification waits for the Phase 3 notifications
-- table.
--
-- Apply (local dev sqlite file):
--   npx wrangler d1 execute brambletally --local --file=./migrations/0007_social.sql
-- Apply (production):
--   npx wrangler d1 execute brambletally --remote --file=./migrations/0007_social.sql

CREATE TABLE follows (
  follower_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (follower_id, followee_id)
);
CREATE INDEX idx_follows_followee ON follows(followee_id);
