-- Brambletally — D1 schema
-- Run with: wrangler d1 execute brambletally --remote --file=./schema.sql
-- (create the DB first: wrangler d1 create brambletally)

PRAGMA foreign_keys = ON;

-- ── Auth ─────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id              TEXT PRIMARY KEY,        -- uuid
  email           TEXT UNIQUE NOT NULL,
  name            TEXT,                    -- legacy display fallback; superseded by display_name / handle
  avatar_url      TEXT,
  plan            TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'supporter' (see worker/api/lib/plan.js)
  handle          TEXT,                    -- 3-20 [a-z0-9_], case-folded; UNIQUE via the partial index below
  handle_set_at   TEXT,                    -- ISO datetime of the last handle write; drives the 30-day change cooldown
  display_name    TEXT,                    -- free text, <= 50; UI falls back to @handle
  is_admin        INTEGER NOT NULL DEFAULT 0,
  tos_accepted_at TEXT,                    -- set at the first-login acceptance gate (Phase 1b)
  tos_version     TEXT,
  board_blocked_at TEXT,                   -- soft sanction: no board posting (guarded from Phase 3)
  disabled_at     TEXT,                    -- hard sanction: router 403s everything but /api/auth/me + logout
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_users_handle ON users(handle) WHERE handle IS NOT NULL;

-- 1:1 with users; split out so the hot auth SELECT in session.js stays lean.
CREATE TABLE user_profiles (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bio         TEXT,                       -- <= 500, escaped on render
  pronouns    TEXT,                       -- <= 40, escaped on render
  notif_prefs TEXT,                       -- JSON: { mode: 'immediate'|'weekly'|'off', types: {...} }
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Structured social links. `platform` drives the icon + label on render;
-- `value` is the full normalised https URL. Rendered rel="me nofollow noopener".
CREATE TABLE user_links (
  id          TEXT PRIMARY KEY,           -- uuid
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform    TEXT NOT NULL,              -- 'website' | 'instagram' | 'bluesky' | 'mastodon' | 'github' | 'etsy' | 'ravelry' | 'youtube' | 'other'
  value       TEXT NOT NULL,              -- full https URL, <= 2000, normalised on write
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_user_links_user ON user_links(user_id);

-- Shared interest-tag index. `slug` is the normalised key; `label` is the
-- display text from whoever first created it. `usage_count` is recomputed on
-- every link/unlink. Near-duplicates are fixed with the admin tag tool.
CREATE TABLE interest_tags (
  id          TEXT PRIMARY KEY,           -- uuid
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

-- User-to-user blocking. A block hides both accounts from each other in user
-- search, profile views, and interest discovery. Reciprocal follows-row
-- deletion is wired in with Phase 2.
CREATE TABLE user_blocks (
  blocker_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (blocker_id, blocked_id)
);
CREATE INDEX idx_blocks_blocked ON user_blocks(blocked_id);

CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,        -- random token, stored as httpOnly cookie
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at    TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE magic_links (
  id            TEXT PRIMARY KEY,        -- uuid
  email         TEXT NOT NULL,           -- may not have a user row yet
  token_hash    TEXT NOT NULL,           -- sha256 of the token sent via email
  expires_at    TEXT NOT NULL,
  used_at       TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_magic_links_email ON magic_links(email);

-- ── Projects ─────────────────────────────────────────────────────────────

-- Per-user pick list for the project "category" field. Managed by the owner;
-- the chosen name is denormalized onto projects.category.
CREATE TABLE categories (
  id            TEXT PRIMARY KEY,        -- uuid
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, name)
);
CREATE INDEX idx_categories_user ON categories(user_id);

CREATE TABLE projects (
  id            TEXT PRIMARY KEY,        -- uuid
  owner_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category      TEXT,                    -- free-form name, nullable; picked from the owner's categories
  title         TEXT NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'Active'
                  CHECK(status IN ('Active','Waiting For','Someday','Paused','Done')),
  deadline      TEXT,                    -- ISO date, nullable
  pickup_note   TEXT,                    -- freeform "Project notes" box (legacy column name)
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_projects_owner ON projects(owner_id);

-- Every user with access to a project has a row here, including the owner.
-- This is the single source of truth for permission checks.
CREATE TABLE project_collaborators (
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK(role IN ('owner','editor','viewer')),
  added_at      TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX idx_collab_user ON project_collaborators(user_id);

-- Invite by email for people who haven't signed up yet.
-- On first login with a matching email, resolve into project_collaborators
-- and mark accepted_at.
CREATE TABLE pending_invites (
  id            TEXT PRIMARY KEY,        -- uuid
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  role          TEXT NOT NULL CHECK(role IN ('editor','viewer')),
  invited_by    TEXT NOT NULL REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  accepted_at   TEXT
);
CREATE INDEX idx_invites_email ON pending_invites(email);

CREATE TABLE ownership_transfer_log (
  id              TEXT PRIMARY KEY,      -- uuid
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_user_id    TEXT NOT NULL REFERENCES users(id),
  to_user_id      TEXT NOT NULL REFERENCES users(id),
  transferred_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Project content ──────────────────────────────────────────────────────

CREATE TABLE project_steps (
  id            TEXT PRIMARY KEY,        -- uuid
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_step_id TEXT REFERENCES project_steps(id) ON DELETE CASCADE,  -- sub-step ("bash"); one level only
  title         TEXT NOT NULL,
  completed     INTEGER NOT NULL DEFAULT 0,
  completed_at  TEXT,                    -- ISO datetime; set when completed flips to 1, cleared on 0
  due_date      TEXT,                    -- ISO date, nullable
  notes         TEXT,                    -- free-text working notes for this step
  estimate_minutes INTEGER,             -- NULL = no estimate; else one of 5/15/30/60/120/240/480
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_steps_project ON project_steps(project_id);
CREATE INDEX idx_steps_parent ON project_steps(parent_step_id);

CREATE TABLE project_supplies (
  id            TEXT PRIMARY KEY,        -- uuid
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  acquired      INTEGER NOT NULL DEFAULT 0,
  cost          REAL,
  source        TEXT,                    -- where to get it (store name)
  url           TEXT,                    -- optional link
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_supplies_project ON project_supplies(project_id);

-- Per-project link list: reference material, inspiration, product pages, docs.
-- Separate from project_supplies.url (one link per supply). No server-side
-- title/favicon fetch — a blank title renders as the URL hostname.
CREATE TABLE project_links (
  id            TEXT PRIMARY KEY,        -- uuid
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,           -- http(s) only, <= 2000, normalised on write
  title         TEXT,                    -- optional label, <= 200; UI falls back to hostname
  note          TEXT,                    -- optional "why this matters", <= 500
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_links_project ON project_links(project_id);

CREATE TABLE project_journal (
  id            TEXT PRIMARY KEY,        -- uuid
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id),
  text          TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_journal_project ON project_journal(project_id);

-- ── GTD capture ──────────────────────────────────────────────────────────

CREATE TABLE inbox_items (
  id            TEXT PRIMARY KEY,        -- uuid
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text          TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_inbox_user ON inbox_items(user_id);
