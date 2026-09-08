-- 0009_social.sql
-- Social Phase 3b: notifications. One row per notifiable event for a recipient.
-- In-app always; an email goes out immediately (notif_prefs.mode = 'immediate')
-- or in the Sunday weekly digest (mode = 'weekly'); 'off' or a disabled type
-- means no row is written at all.
--
-- Apply (local dev sqlite file):
--   npx wrangler d1 execute brambletally --local --file=./migrations/0009_social.sql
-- Apply (production):
--   npx wrangler d1 execute brambletally --remote --file=./migrations/0009_social.sql

CREATE TABLE notifications (
  id           TEXT PRIMARY KEY,            -- uuid
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- recipient
  type         TEXT NOT NULL,               -- follow | contributor_request | contributor_decided | board_comment | board_reply
  actor_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  subject_type TEXT,                        -- listing | comment | request | profile
  subject_id   TEXT,
  preview      TEXT,                        -- short text for the dropdown / digest line
  read_at      TEXT,
  emailed_at   TEXT,                        -- set once the immediate email or the digest goes out
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notifications_user ON notifications(user_id, read_at, created_at);
CREATE INDEX idx_notifications_undelivered ON notifications(emailed_at, created_at);
