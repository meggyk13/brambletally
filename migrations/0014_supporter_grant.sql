-- 0014_supporter_grant.sql
-- Manual Supporter grant/revoke (docs/social-plan.md "Supporter tier") — the
-- stand-in for billing until a payment processor is wired up. Reuses the
-- existing admin-panel "Moderation history" list rather than building a
-- separate audit trail, so moderation_actions.action needs two new values.
-- SQLite can't ALTER a CHECK constraint in place; recreate the table.
--
-- Apply (local dev sqlite file):
--   npx wrangler d1 execute brambletally --local --file=./migrations/0014_supporter_grant.sql
-- Apply (production):
--   npx wrangler d1 execute brambletally --remote --file=./migrations/0014_supporter_grant.sql

CREATE TABLE moderation_actions_new (
  id             TEXT PRIMARY KEY,
  admin_id       TEXT NOT NULL REFERENCES users(id),
  target_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_id      TEXT REFERENCES reports(id) ON DELETE SET NULL,
  action         TEXT NOT NULL
                   CHECK(action IN ('board_block','board_unblock',
                                    'disable','enable','content_removed',
                                    'grant_supporter','revoke_supporter')),
  note           TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO moderation_actions_new SELECT * FROM moderation_actions;
DROP TABLE moderation_actions;
ALTER TABLE moderation_actions_new RENAME TO moderation_actions;
CREATE INDEX idx_mod_actions_target ON moderation_actions(target_user_id, created_at);
