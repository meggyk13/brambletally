-- 0008_social.sql
-- Social Phase 3a: the public "help wanted" board. An owner opts a project in
-- with a headline + a "what I need help with" body; other signed-in users
-- comment (one level of replies) or request to contribute. An accepted request
-- adds the requester as a `viewer` collaborator on the project.
--
-- Apply (local dev sqlite file):
--   npx wrangler d1 execute brambletally --local --file=./migrations/0008_social.sql
-- Apply (production):
--   npx wrangler d1 execute brambletally --remote --file=./migrations/0008_social.sql

-- One listing per project. The public blurb + lifecycle live here, off the core
-- projects row.
CREATE TABLE project_listings (
  id           TEXT PRIMARY KEY,             -- uuid
  project_id   TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  created_by   TEXT NOT NULL REFERENCES users(id),
  headline     TEXT NOT NULL,                -- <= 120
  help_wanted  TEXT NOT NULL,                -- <= 2000, escaped on render
  status       TEXT NOT NULL DEFAULT 'open'
                 CHECK(status IN ('open','closed','archived')),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_listings_status ON project_listings(status, updated_at);

-- One level of replies only (parent_comment_id points at a top-level comment).
-- Soft delete keeps the row so replies keep their context.
CREATE TABLE listing_comments (
  id                TEXT PRIMARY KEY,        -- uuid
  listing_id        TEXT NOT NULL REFERENCES project_listings(id) ON DELETE CASCADE,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_comment_id TEXT REFERENCES listing_comments(id) ON DELETE CASCADE,
  body              TEXT NOT NULL,           -- <= 2000, escaped on render
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  edited_at         TEXT,
  deleted_at        TEXT
);
CREATE INDEX idx_listing_comments_listing ON listing_comments(listing_id, created_at);

-- One live request per person per listing (UNIQUE). A declined/withdrawn row is
-- reused when the person re-requests (status back to 'pending', decided_* cleared).
CREATE TABLE contributor_requests (
  id            TEXT PRIMARY KEY,            -- uuid
  listing_id    TEXT NOT NULL REFERENCES project_listings(id) ON DELETE CASCADE,
  requester_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message       TEXT,                        -- <= 1000
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK(status IN ('pending','accepted','declined','withdrawn')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at    TEXT,
  decided_by    TEXT REFERENCES users(id),
  UNIQUE (listing_id, requester_id)
);
CREATE INDEX idx_contrib_req_listing ON contributor_requests(listing_id, status);
