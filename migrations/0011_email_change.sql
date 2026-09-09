-- 0011_email_change.sql
-- Email-change flow: a pending request holds the new address and a hashed
-- token until the owner confirms it from a link mailed to that new address.
-- One live request per user at a time (the endpoint marks older ones used).
--
-- Apply (local dev sqlite file):
--   npx wrangler d1 execute brambletally --local --file=./migrations/0011_email_change.sql
-- Apply (production):
--   npx wrangler d1 execute brambletally --remote --file=./migrations/0011_email_change.sql

CREATE TABLE email_change_requests (
  id          TEXT PRIMARY KEY,               -- uuid
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  new_email   TEXT NOT NULL,                  -- lower-cased, trimmed
  token_hash  TEXT NOT NULL,                  -- sha256 of the token in the link
  expires_at  TEXT NOT NULL,
  used_at     TEXT,                           -- set when claimed, or when superseded
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_email_change_user ON email_change_requests(user_id, used_at);
