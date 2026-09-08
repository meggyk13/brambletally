-- 0010_social.sql
-- Social Phase 3c: the report queue and the moderation audit trail.
--
-- target_id is a loose reference (no FK) so a report survives the reported
-- content being deleted — the admin just sees "content already removed".
-- reporter_id nulls out if that account is deleted.
--
-- Apply (local dev sqlite file):
--   npx wrangler d1 execute brambletally --local --file=./migrations/0010_social.sql
-- Apply (production):
--   npx wrangler d1 execute brambletally --remote --file=./migrations/0010_social.sql

CREATE TABLE reports (
  id              TEXT PRIMARY KEY,          -- uuid
  reporter_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  target_type     TEXT NOT NULL,             -- listing | comment | profile
  target_id       TEXT NOT NULL,             -- loose ref (no FK)
  category        TEXT NOT NULL,             -- spam | harassment | illegal | other
  detail          TEXT,                      -- optional free text, <= 1000
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK(status IN ('open','actioned','dismissed')),
  resolved_by     TEXT REFERENCES users(id),
  resolved_at     TEXT,
  resolution_note TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_reports_status ON reports(status, created_at);
-- one open report per reporter+target
CREATE UNIQUE INDEX idx_reports_one_open
  ON reports(reporter_id, target_type, target_id) WHERE status = 'open';

-- Audit trail for admin sanctions, in the spirit of ownership_transfer_log.
CREATE TABLE moderation_actions (
  id             TEXT PRIMARY KEY,           -- uuid
  admin_id       TEXT NOT NULL REFERENCES users(id),
  target_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_id      TEXT REFERENCES reports(id) ON DELETE SET NULL,
  action         TEXT NOT NULL
                   CHECK(action IN ('board_block','board_unblock',
                                    'disable','enable','content_removed')),
  note           TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_mod_actions_target ON moderation_actions(target_user_id, created_at);
