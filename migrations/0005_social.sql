-- 0005_social.sql
-- Social Phase 1b-ii: the profile editor's own tables — structured social links
-- and the shared interest-tag index. bio / pronouns already exist on
-- user_profiles (0004); this migration only adds the new tables.
--
-- Apply (local dev sqlite file):
--   npx wrangler d1 execute brambletally --local --file=./migrations/0005_social.sql
-- Apply (production):
--   npx wrangler d1 execute brambletally --remote --file=./migrations/0005_social.sql

-- Structured social links. `platform` drives the icon + label on render; `value`
-- is the full normalised https URL (https-only, rejected otherwise). Rendered
-- with rel="me nofollow noopener" target="_blank".
CREATE TABLE user_links (
  id          TEXT PRIMARY KEY,             -- uuid
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform    TEXT NOT NULL,                -- 'website' | 'instagram' | 'bluesky' | 'mastodon' | 'github' | 'etsy' | 'ravelry' | 'youtube' | 'other'
  value       TEXT NOT NULL,                -- full https URL, <= 2000, normalised on write
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_user_links_user ON user_links(user_id);

-- Shared interest tags. `slug` is the normalised key (lowercase, diacritics
-- folded, spaces to hyphens); `label` is the display text from whoever first
-- created it. `usage_count` is recomputed on every link/unlink for cheap
-- sorting. No merge tooling here — the admin tag tool (Phase 1b-ii PR 2) fixes
-- near-duplicates.
CREATE TABLE interest_tags (
  id          TEXT PRIMARY KEY,             -- uuid
  slug        TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE user_interests (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag_id      TEXT NOT NULL REFERENCES interest_tags(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, tag_id)
);
CREATE INDEX idx_user_interests_tag ON user_interests(tag_id);
