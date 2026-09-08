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
  calendar_token  TEXT,                    -- keys the per-user ICS feed (migration 0012); UNIQUE via the partial index below
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_users_handle ON users(handle) WHERE handle IS NOT NULL;
CREATE UNIQUE INDEX idx_users_calendar_token ON users(calendar_token) WHERE calendar_token IS NOT NULL;

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
-- search, profile views, and interest discovery, and deletes any follows row in
-- either direction (POST /api/blocks).
CREATE TABLE user_blocks (
  blocker_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (blocker_id, blocked_id)
);
CREATE INDEX idx_blocks_blocked ON user_blocks(blocked_id);

-- Following: asymmetric, no accept step. A follow either exists or it doesn't.
CREATE TABLE follows (
  follower_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (follower_id, followee_id)
);
CREATE INDEX idx_follows_followee ON follows(followee_id);

-- ── Board (Phase 3) ──────────────────────────────────────────────────────

-- One "help wanted" listing per project. Public blurb + lifecycle, off the
-- core projects row.
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

-- One level of replies only; soft delete keeps the row for reply context.
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

-- One live request per person per listing (UNIQUE); a declined/withdrawn row is
-- reused on re-request (status back to 'pending', decided_* cleared).
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

-- One row per notifiable event. In-app always; email is immediate, weekly-digest,
-- or off per the recipient's notif_prefs (an 'off' type writes no row).
CREATE TABLE notifications (
  id           TEXT PRIMARY KEY,            -- uuid
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- recipient
  type         TEXT NOT NULL,               -- follow | contributor_request | contributor_decided | board_comment | board_reply
  actor_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  subject_type TEXT,                        -- listing | comment | request | profile
  subject_id   TEXT,
  preview      TEXT,
  read_at      TEXT,
  emailed_at   TEXT,                        -- set once the immediate email or the digest goes out
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notifications_user ON notifications(user_id, read_at, created_at);
CREATE INDEX idx_notifications_undelivered ON notifications(emailed_at, created_at);

-- Report queue. target_id is a loose ref (no FK) so a report outlives its
-- target; reporter_id nulls out if that account is deleted.
CREATE TABLE reports (
  id              TEXT PRIMARY KEY,          -- uuid
  reporter_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  target_type     TEXT NOT NULL,             -- listing | comment | profile
  target_id       TEXT NOT NULL,
  category        TEXT NOT NULL,             -- spam | harassment | illegal | other
  detail          TEXT,                      -- optional, <= 1000
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK(status IN ('open','actioned','dismissed')),
  resolved_by     TEXT REFERENCES users(id),
  resolved_at     TEXT,
  resolution_note TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_reports_status ON reports(status, created_at);
CREATE UNIQUE INDEX idx_reports_one_open
  ON reports(reporter_id, target_type, target_id) WHERE status = 'open';

-- Audit trail for admin sanctions.
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

-- Pending email changes (migration 0011). The confirm link goes to the NEW
-- address; the token proves control of it. One live request per user — the
-- endpoint marks older ones used before inserting.
CREATE TABLE email_change_requests (
  id            TEXT PRIMARY KEY,        -- uuid
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  new_email     TEXT NOT NULL,           -- lower-cased, trimmed
  token_hash    TEXT NOT NULL,           -- sha256 of the token in the link
  expires_at    TEXT NOT NULL,
  used_at       TEXT,                    -- set when claimed, or when superseded
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_email_change_user ON email_change_requests(user_id, used_at);

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

-- Planned focus time (migration 0012). One collaborator's intention to work on
-- a project (optionally a step) in a window. Each collaborator plans their own.
CREATE TABLE work_sessions (
  id            TEXT PRIMARY KEY,        -- uuid
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  step_id       TEXT REFERENCES project_steps(id) ON DELETE SET NULL,  -- optional
  starts_at     TEXT NOT NULL,           -- "YYYY-MM-DD HH:MM:SS" UTC, like datetime('now')
  ends_at       TEXT NOT NULL,
  note          TEXT,                    -- optional, <= 500
  status        TEXT NOT NULL DEFAULT 'planned'
                  CHECK(status IN ('planned','done','skipped')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_work_sessions_user ON work_sessions(user_id, starts_at);
CREATE INDEX idx_work_sessions_project ON work_sessions(project_id, starts_at);

-- ── GTD capture ──────────────────────────────────────────────────────────

CREATE TABLE inbox_items (
  id            TEXT PRIMARY KEY,        -- uuid
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text          TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_inbox_user ON inbox_items(user_id);
