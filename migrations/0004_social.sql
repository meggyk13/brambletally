-- 0004_social.sql
-- Social Phase 1b-i: user_profiles, a 1:1 row split off users so the hot auth
-- SELECT in session.js stays lean. Phase 1b-i uses notif_prefs; bio and
-- pronouns are filled in by the profile editor in Phase 1b-ii.
--
-- Apply (local dev sqlite file):
--   npx wrangler d1 execute brambletally --local --file=./migrations/0004_social.sql
-- Apply (production):
--   npx wrangler d1 execute brambletally --remote --file=./migrations/0004_social.sql

CREATE TABLE user_profiles (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bio         TEXT,                       -- <= 500, escaped on render (Phase 1b-ii)
  pronouns    TEXT,                       -- <= 40, escaped on render (Phase 1b-ii)
  notif_prefs TEXT,                       -- JSON: { mode: 'immediate'|'weekly'|'off', types: {...} }
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
