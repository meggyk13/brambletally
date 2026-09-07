-- 0002_project_links.sql
-- A per-project link list (reference material, inspiration, product pages, docs).
--
-- Apply (local dev sqlite file):
--   npx wrangler d1 execute brambletally --local --file=./migrations/0002_project_links.sql
-- Apply (production):
--   npx wrangler d1 execute brambletally --remote --file=./migrations/0002_project_links.sql

CREATE TABLE project_links (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  title         TEXT,
  note          TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_links_project ON project_links(project_id);
