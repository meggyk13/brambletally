# Brambletally — Social Features Build Plan

Scoping doc for four additions: profiles, settings, a public "help wanted"
project board, and following between users. Companion to `brambletally_plan.md`
and `brambletally_schema.sql`.

Status: **scoping**. Requirements below are mostly locked (see "Decisions");
a few sub-points are still open (see "Open questions").

## Guiding constraint

**Everything stays behind the login wall for v1.** Every "other user" you can
see is a signed-in account. This one rule keeps the abuse, privacy, and
moderation surface small enough to self-manage. It can be relaxed later without
schema rework.

The exceptions are the **marketing landing page** at `/` and the **legal
pages** — public and indexable (they carry no user data and no abuse surface).
The app at `/app` and every `/api/*` route stay private and `noindex`. See
"Planned: Landing page" in `docs/plan.md`.

## Feature summary

1. **Profiles** — chosen display name + unique handle, bio, pronouns,
   interests, social links, avatar. Visible to any signed-in user.
2. **Settings** — account (email change, handle), notification preferences,
   theme, data export, account deletion, blocked-users list.
3. **Public project board** — an owner opts a project in with a "help wanted"
   note. Other signed-in users comment or request to contribute. An accepted
   request adds the requester as a **viewer** collaborator; the owner can
   promote to editor afterward.
4. **Following** — asymmetric, no accept step. Powers an activity feed and the
   collaborator-invite picker.

Cross-cutting: **blocking**, **email notifications** (Resend is live),
a board-scoped **admin flag**, and **legal pages** (ToS, acceptable use,
privacy, cookies) with a first-login acceptance gate.

## Decisions (locked 2026-09-07)

1. Login-only for v1. No public pages.
2. Photo support for projects is wanted "at some point" — it rides in the same
   R2 phase as avatars, after the first three phases.
3. Resend is live. Email notifications are in scope. Per-type on/off plus an
   immediate-vs-weekly-digest choice, managed in settings.
4. **Following, not friending.** Asymmetric. No request/accept handshake.
5. Owners self-moderate their own board listings (delete any comment, decline
   or block contributor requests). An `is_admin` flag lets a named account
   delete any board listing or comment, work the report queue, merge interest
   tags, and sanction a user — all through an in-app **admin panel** (no
   god-mode over private projects).
6. Contributor request accepted → `viewer`. Owner promotes to `editor` later
   through the existing collaborators UI.
7. ToS + acceptable-use + privacy + cookie policy pages are in scope, plus a
   one-time cookie notice.
8. **Handle changes** allowed, rate-limited to once per 30 days.
9. **Interests** are a shared tag index, not per-user free text. A profile
   lists its tags; each tag links to a discovery list of other users who
   share it.
10. **Board card** shows, pre-acceptance: project title, project created date,
    a task summary ("10 tasks · 3 done"), and the next ~3 open steps by due
    date. Not the description, journal, supplies, or full step list — those
    come with the `viewer` role on acceptance.
11. **Feed** defaults to all board activity. A "Following" filter narrows it to
    people you follow; followed users' events are visually marked in the
    default view too.
12. **Weekly digest** goes out Sunday 08:00 PT for everyone. Not per-user
    scheduling for now.
13. **In-app admin panel** — a view in the Brambletally client, shown only when
    `is_admin`. Handles the report queue and interest-tag merge/rename, and
    lists all board listings for takedown. Reports are stored in a `reports`
    table, not email-only; `ADMIN_EMAIL` is still used for an optional
    new-report ping.
14. **Re-request rules** — a declined or withdrawn contributor request can be
    re-opened. It reuses the same `contributor_requests` row (`status` back to
    `pending`, `decided_*` cleared) and counts against the ~10/day per-user
    request cap.
15. **Sanctions have two levels**, both reversible, both logged to
    `moderation_actions`:
    - **Board block** (`users.board_blocked_at`) — soft. The account works
      normally (private projects, collaboration, tools) but can't create
      listings, comment, or send contributor requests. Can still browse the
      board and file reports.
    - **Account disable** (`users.disabled_at`) — hard. Every API returns 403
      except sign-in state, logout, data export, and account deletion; the
      client shows a "suspended" screen. Data-subject rights stay intact.
    Existing content from a sanctioned user is left in place — the admin
    removes specific items separately.

## Hosting costs — when they start

Nothing here costs money at this site's scale for a long time. Two places cost
eventually appears, both scaling gently. (Cloudflare / Resend figures are as of
early 2026 — verify against current dashboards, but the shape holds.)

### Photos → R2

Free tier: ~10 GB storage, ~1M uploads/month, ~10M reads/month, **no egress
charge ever**. Storage is the only line you'll approach.

| Uploads are… | ~10 GB holds |
| --- | --- |
| resized to ~400 KB each (client-side, ~1600px/q80) | ~26,000 photos (~1,300 projects at 20 each) |
| raw ~5 MB phone photos, unresized | ~2,000 photos (~100 projects) |

Past 10 GB: **$0.015 / GB-month**. 50 GB of photos ≈ $0.60/month. It scales in
cents. Not resizing on upload is the only thing that breaks this — so a resize
step is a build requirement (see "Resize approach" under Phase 4).

### Email → Resend

Free tier: ~3,000/month but **capped at ~100/day**. With immediate emails a
busy board and a few hundred users could brush the daily cap; the **weekly
digest** option (one email per user each Sunday, sent by a Cron Trigger) keeps
most users well under it. Next paid tier ≈ $20/month.

### Workers + D1

Free tier (100k requests/day; millions of D1 row-reads/day) covers all of this
for a small user base. The $5/month Workers Paid plan is a later choice, not a
requirement.

### Cost controls to build in from day one

- **Resize + re-encode every upload** (see "Resize approach" under Phase 4).
  Client-side `<canvas>` resize to ~1600px on the long edge / q80 now, with the
  server rejecting anything over 2 MB; move the resize into the Worker
  (Photon/WASM) once on Workers Paid. Store only the resized copy. Biggest
  single lever.
- **Caps as safety valves:** ~30 photos per project, 1 avatar per user.
- **`Cache-Control: public, max-age=31536000, immutable`** on image responses
  (versioned R2 keys) so the CDN serves repeats and Class B reads stay near
  zero.
- **Weekly-digest email option** so notification volume can't push a user past
  Resend's daily cap.

## Supporter tier

A **$10/year "Supporter"** plan. Scaffolded alongside Phase 1; **billing is not
built until there are real users who might pay.** Nothing about it gates the
core app — projects, steps, supplies, journal, links, collaboration, the inbox,
review, and the calculators stay free and unlimited. Gating cheap text rows
would contradict the "self-manageable, everything behind login" ethos; the
perks that cost money (R2 storage, Resend volume) are what the tier offsets.

### Ships in Phase 1 (no billing)

- `users.plan` already exists (`DEFAULT 'free'`, in `/api/auth/me`). Values:
  `'free'` | `'supporter'`. No migration needed to scaffold.
- `isSupporter(user)` helper in `worker/api/lib/` — the single gate check used
  everywhere. Today: `user.plan === 'supporter'`. Later also checks
  subscription status / expiry.
- **Supporter badge** on the profile, board cards, and the collaborator-invite
  picker.
- A **Supporter** section in Settings showing plan status — inert until there
  is something to buy.
- **Manual grant** through the admin panel (set `plan`), so early supporters
  and testers can be comped before Stripe exists.

### Gates (designed now, enforced as each feature lands)

| Area | Free | Supporter |
| --- | --- | --- |
| Projects / steps / supplies / journal / links / collaboration | unlimited | unlimited |
| Project photos (Phase 4) | 10 / project | 30 / project |
| Avatar (Phase 4) | initials | uploaded image |
| Email notifications (Phase 3) | weekly digest | immediate |
| Active board listings (Phase 3) | 1 | 3 |
| Profile badge + accent colour | — | yes |

### Deferred until there are users

Stripe Checkout (annual billing), a webhook module under `worker/api/`, and
additive columns on `users` — `stripe_customer_id`, `subscription_status`,
`current_period_end` (plain `ALTER`, no rework). Cancellation runs through
Stripe's hosted portal. On a $10 charge Stripe takes ~$0.59 (~6%); annual
billing keeps that to one transaction per member per year. A lifetime option
(one-time ~$25) is a later call.

## Identity model — Phase 1a shipped in PR #9 (2026-09-07)

**Built:** `migrations/0003_social.sql` adds to `users`: `handle`,
`handle_set_at`, `display_name`, `is_admin`, `tos_accepted_at`, `tos_version`,
`board_blocked_at`, `disabled_at`, plus the partial unique index
`idx_users_handle`. Folded into `schema.sql`.
`worker/api/lib/handle.js` (`normalizeHandle` — format + reserved words) and
`worker/api/lib/plan.js` (`isSupporter`). `loadSession` selects the new columns
into `context.data.user`. `worker/index.js` 403s any route but `/api/auth/me`
and `/api/auth/logout` when `disabled_at` is set (emergency stop; a by-hand D1
edit is the trigger until the admin panel exists). `/api/auth/me` now returns
`{ user, needs_handle, supporter }`. New endpoints: `PUT /api/profile/handle`
(first set free, 30-day cooldown on changes, 409 on collision) and
`PATCH /api/profile` (`display_name` only for now). `users/search` also matches
`display_name` and `@handle`.
Frontend: `boot` keeps the full `me` payload in `state.me`; `render` routes to
a **"Pick a handle"** screen when `needs_handle`, an **"Account suspended"**
screen when `disabled_at`, else the app. A gold **Supporter** pill in the
header when `state.me.supporter`. `handleReason` mirrors the server format
rules for inline feedback.
**Phase 1b-i shipped in PR #10 (2026-09-07):** `migrations/0004_social.sql`
adds `user_profiles` (bio, pronouns, notif_prefs, updated_at). New
`worker/api/lib/notif.js` (modes / types / `sanitizeNotifPrefs` /
`readNotifPrefs`). `/api/auth/me` now also returns `notif_prefs`. New endpoints:
`PATCH /api/settings/notif-prefs` (upsert), `GET /api/settings/export` (JSON
attachment — profile, categories, inbox, owned projects with full contents, a
reference list of shared projects), `DELETE /api/account` (permanent; 409 while
an owned project still has another collaborator). Frontend: a **Settings**
screen (`state.view === 'settings'`, gear button in the header) with sections
Appearance (the picker moved out of its modal into `appearanceControls()`),
Account (email, handle change via `openHandleChange`, display-name edit),
Notifications (mode segmented control + per-type toggles, saved live), Your data
(export / delete), Plan (status). The header `#bt-theme` button reverts to a
blind light/dark flip.

**Phase 1b-ii PR 1 shipped in PR #TBD (2026-09-07):** `migrations/0005_social.sql`
adds `user_links` (platform + full https `value` + `sort_order`), `interest_tags`
(slug/label/`usage_count`) and `user_interests`. Folded into `schema.sql`. New
`worker/api/lib/profile.js` — `LINK_PLATFORMS` + `httpsUrlOrNull` + `normalizeLinks`,
and `slugify` + `normalizeInterestLabels` (NFKD diacritic fold, `MAX_INTERESTS`
15, label cap 30). `PATCH /api/profile` extended to `bio` + `pronouns` (upsert on
`user_profiles`, read-modify-write so an absent key isn't nulled). New endpoints:
`GET /api/profile/:handle` (the bundle — identity, `supporter`, `is_admin`, bio,
pronouns, links, interests, `is_self`; 404 on a disabled account unless self),
`PUT /api/profile/links` (replace-set, non-https dropped), `GET /api/interests?q=`
(autocomplete; empty `q` → top by `usage_count`), `PUT /api/interests` (replace-set
by label; upserts tags, keeps `usage_count` exact for every touched tag in one
batch), `GET /api/interests/:slug` (discovery list, `?cursor=` offset paging,
disabled excluded). `worker/api/search.js` gains a `people` section (handle /
display_name / name; self + disabled excluded; leading `@` scopes to people).
Route table: literal `/api/profile/links` + `/api/profile/handle` registered
before `/api/profile/:handle` (first match wins); handle reserved-word list
extended (`links`, `blocks`, `follows`, `interests`, …). Frontend: `renderProfile`
/ `renderProfileEdit` / `renderDiscover` views (reusing the Settings shell),
`interestEditor` (removable chips + server autocomplete) and `linksEditor`
(platform select + URL rows) components, initials `avatarEl`, `personRow`. Reached
from global search (People) and Settings → Account → Profile. **Also fixed:**
`worker/api/account.js` had `../lib/` imports (should be `./lib/`) — the build /
`wrangler dev` failed on `main` before this.

**Still Phase 1b-ii PR 2:** `user_blocks` + block/unblock + enforcement (search,
profile, discovery, feed later), `requireAdmin` helper + admin interest-tag tool
(merge / rename / delete). **Separate:** email change, the legal acceptance gate.

---

Today `users.name` is nullable, unverified, non-unique, and defaults to the
email local-part (`worker/api/auth/callback.js:40`). `users/search.js` matches
on name only and never returns email. That is fine for private invites; it is
not enough for profiles, following, or an @-handle.

Add to `users` (or a 1:1 `user_profiles` row — see schema):

- `handle` TEXT UNIQUE — 3–20 chars, `[a-z0-9_]`, case-folded, reserved-word
  list (`admin`, `api`, `settings`, …). Used for profile identity and the
  follow/search picker. Mutable but rate-limited (e.g. once per 30 days).
- `display_name` TEXT — free text, 1–50 chars, escaped on render. Falls back to
  `@handle` if empty.
- Backfill: on first login after this ships, prompt for a handle before the app
  loads. Existing accounts get a generated handle (`user_ab12cd`) they can
  change.

Everything social hangs off `handle` + the user id. Do this migration before
anything else in this plan.

The same migration adds `board_blocked_at` and `disabled_at` (see Sanctions).
The `disabled_at` gate goes into `loadSession` / the router in Phase 1 so a
by-hand D1 edit is a working emergency stop before the admin UI exists;
`board_blocked_at` has nothing to guard until the board ships in Phase 3.

## Following model

`follows (follower_id, followee_id, created_at)`, PK `(follower_id,
followee_id)`. No status column — a follow either exists or doesn't.

- Follow / unfollow is one insert / one delete. No notification to approve.
  A `follow` **does** create a notification for the followee ("X started
  following you"), subject to their prefs.
- **Block** (`user_blocks`) deletes any `follows` row in both directions and
  blocks re-follow. Enforced in: follow, user search, board comments,
  contributor requests, the activity feed.
- No "followers-only" content tier. A unilateral follow can't gate anything
  meaningfully, and with everything already behind login the audience is a
  known bounded set. Profile fields are simply shown or hidden.
- **Activity feed** (`GET /api/feed`): reverse-chron, derived at read time from
  `project_listings` and `listing_comments`, excluding events where either
  party is blocked. Board events only — never private project activity.
  - Default view returns **all** board activity. Each event carries a
    `from_followed` boolean so the client can mark followed users' events
    (accent border, "you follow" tag).
  - `?filter=following` narrows to events whose actor is in the caller's
    follow set.
  - No separate `feed_events` table for v1; add one only if the read query
    gets slow.
- Mutual follow can stand in for "friends" later. Nothing is lost by starting
  asymmetric.

## Schema additions

New tables. All user-referencing FKs are `ON DELETE CASCADE` unless noted.
Fold into `schema.sql` for fresh installs; ship as
`migrations/0003_social.sql` for the live DB (`0002` is `project_links` — see
`docs/plan.md`).

```sql
-- 1:1 with users. Split out so the hot auth SELECT in session.js stays lean.
CREATE TABLE user_profiles (
  user_id        TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bio            TEXT,                      -- <= 500 chars, escaped on render
  pronouns       TEXT,                      -- <= 40 chars, free text, escaped
  notif_prefs    TEXT,                      -- JSON: { mode: 'immediate'|'weekly'|'off', types: {...} }
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Structured social links. Platform drives the URL template + icon; value is
-- the handle or full URL. https-only, rel="me nofollow noopener" on render.
CREATE TABLE user_links (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform       TEXT NOT NULL,             -- 'website' | 'instagram' | 'bluesky' | 'mastodon' | ...
  value          TEXT NOT NULL,
  sort_order     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_user_links_user ON user_links(user_id);

-- Shared interest tags. `slug` is the normalized key (lowercase, spaces to
-- hyphens, diacritics folded); `label` is the display text from whoever first
-- created it. No merge tooling in v1 — an admin can fix near-duplicates by
-- hand later. `usage_count` is maintained on link/unlink for cheap sorting.
CREATE TABLE interest_tags (
  id             TEXT PRIMARY KEY,
  slug           TEXT NOT NULL UNIQUE,
  label          TEXT NOT NULL,
  usage_count    INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE user_interests (
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag_id         TEXT NOT NULL REFERENCES interest_tags(id) ON DELETE CASCADE,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, tag_id)
);
CREATE INDEX idx_user_interests_tag ON user_interests(tag_id);

CREATE TABLE follows (
  follower_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (follower_id, followee_id)
);
CREATE INDEX idx_follows_followee ON follows(followee_id);

CREATE TABLE user_blocks (
  blocker_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (blocker_id, blocked_id)
);
CREATE INDEX idx_blocks_blocked ON user_blocks(blocked_id);

-- A project made visible on the board. Separate row so the public blurb,
-- status, and lifecycle stay off the core projects row.
CREATE TABLE project_listings (
  id             TEXT PRIMARY KEY,
  project_id     TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  created_by     TEXT NOT NULL REFERENCES users(id),
  headline       TEXT NOT NULL,             -- <= 120 chars
  help_wanted    TEXT NOT NULL,             -- the "what I need help with" body, <= 2000
  status         TEXT NOT NULL DEFAULT 'open'
                   CHECK(status IN ('open','closed','archived')),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_listings_status ON project_listings(status, updated_at);

CREATE TABLE listing_comments (
  id                TEXT PRIMARY KEY,
  listing_id        TEXT NOT NULL REFERENCES project_listings(id) ON DELETE CASCADE,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_comment_id TEXT REFERENCES listing_comments(id) ON DELETE CASCADE,  -- one level only
  body              TEXT NOT NULL,          -- <= 2000, escaped on render
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  edited_at         TEXT,
  deleted_at        TEXT                    -- soft delete; row kept so replies keep context
);
CREATE INDEX idx_listing_comments_listing ON listing_comments(listing_id, created_at);

CREATE TABLE contributor_requests (
  id             TEXT PRIMARY KEY,
  listing_id     TEXT NOT NULL REFERENCES project_listings(id) ON DELETE CASCADE,
  requester_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message        TEXT,                      -- <= 1000
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK(status IN ('pending','accepted','declined','withdrawn')),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at     TEXT,
  decided_by     TEXT REFERENCES users(id),
  UNIQUE (listing_id, requester_id)         -- one live request per person per listing
);
CREATE INDEX idx_contrib_req_listing ON contributor_requests(listing_id, status);

CREATE TABLE notifications (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- recipient
  type           TEXT NOT NULL,             -- 'follow' | 'contributor_request' | 'contributor_decided' | 'board_comment' | 'board_reply'
  actor_id       TEXT REFERENCES users(id) ON DELETE SET NULL,
  subject_type   TEXT,                      -- 'listing' | 'comment' | 'request'
  subject_id     TEXT,
  preview        TEXT,
  read_at        TEXT,
  emailed_at     TEXT,                      -- set once the email (or digest) goes out
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notifications_user ON notifications(user_id, read_at, created_at);

-- Report queue for the admin panel. target_id is a loose reference (no FK) so a
-- report survives the reported content being deleted — the admin just sees
-- "content already removed". reporter_id nulls out if that account is deleted.
CREATE TABLE reports (
  id              TEXT PRIMARY KEY,
  reporter_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  target_type     TEXT NOT NULL,            -- 'listing' | 'comment' | 'profile'
  target_id       TEXT NOT NULL,
  category        TEXT NOT NULL,            -- 'spam' | 'harassment' | 'illegal' | 'other'
  detail          TEXT,                     -- optional free text, <= 1000
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

-- Audit trail for admin sanctions, in the spirit of ownership_transfer_log.
CREATE TABLE moderation_actions (
  id             TEXT PRIMARY KEY,
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
```

Add to `users`:

```sql
ALTER TABLE users ADD COLUMN handle       TEXT;    -- UNIQUE enforced via index below
ALTER TABLE users ADD COLUMN display_name TEXT;
ALTER TABLE users ADD COLUMN is_admin     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN tos_accepted_at   TEXT;
ALTER TABLE users ADD COLUMN tos_version       TEXT;
ALTER TABLE users ADD COLUMN board_blocked_at  TEXT;  -- soft sanction: no board posting
ALTER TABLE users ADD COLUMN disabled_at       TEXT;  -- hard sanction: account suspended
CREATE UNIQUE INDEX idx_users_handle ON users(handle) WHERE handle IS NOT NULL;
```

`avatar_url` already exists on `users` — it stays, populated in the R2 phase.

## API surface (new endpoints)

Follows the existing `worker/api/**` + `routes.js` pattern (one module per
path, `onRequestGet/Post/Patch/Delete`).

```
GET    /api/profile/:handle            public-within-login profile bundle
PATCH  /api/profile                    edit own profile (display_name, bio, pronouns)
PUT    /api/profile/handle             change handle (rejected within 30d of last change)
GET    /api/profile/:handle/links      social links
PUT    /api/profile/links              replace own link set (array)

GET    /api/interests?q=               tag autocomplete for the profile editor
PUT    /api/interests                  replace own tag set (array of labels; server slugs + upserts)
GET    /api/interests/:slug            discovery — users who share this tag, paged

POST   /api/follows                    { handle } -> follow
DELETE /api/follows/:handle            unfollow
GET    /api/profile/:handle/followers  list
GET    /api/profile/:handle/following  list
GET    /api/feed?filter=all|following  board activity feed (see Following model); default all

POST   /api/blocks                     { handle }
DELETE /api/blocks/:handle
GET    /api/blocks                     own block list (settings)

GET    /api/board                      open listings, paged, newest-active first (card bundle — see below)
POST   /api/board                      { projectId, headline, help_wanted } -> create listing (owner only)
GET    /api/board/:listingId           listing + card bundle + comments + own request state
PATCH  /api/board/:listingId           edit headline/body/status (owner or admin)
DELETE /api/board/:listingId           owner or admin

POST   /api/board/:listingId/comments  { body, parentCommentId? }
PATCH  /api/board/:listingId/comments/:commentId   author edits own
DELETE /api/board/:listingId/comments/:commentId   author, listing owner, or admin

POST   /api/board/:listingId/requests               { message }
PATCH  /api/board/:listingId/requests/:requestId    { status: 'accepted'|'declined' }  owner
DELETE /api/board/:listingId/requests/:requestId    requester withdraws

GET    /api/notifications              paged; unread count in a header
POST   /api/notifications/read         { ids? } -> mark read (all if omitted)

POST   /api/reports                    { targetType, targetId, category, detail? }  (rate-limited)

PATCH  /api/settings/notif-prefs       { mode, types }
POST   /api/settings/email             start email change (magic link to NEW address)
GET    /api/settings/export            JSON dump of the caller's data
DELETE /api/account                    delete account (guarded — see below)

# admin panel — every route gated by a requireAdmin(context) helper
GET    /api/admin/reports              queue; ?status=open (default) | actioned | dismissed | all
PATCH  /api/admin/reports/:reportId    { status: 'actioned'|'dismissed', note? }
GET    /api/admin/interests            all tags, usage_count desc, ?q= filter
POST   /api/admin/interests/merge      { fromSlug, toSlug } -> repoint + recount + drop loser
PATCH  /api/admin/interests/:slug      { label?, slug? } rename
DELETE /api/admin/interests/:slug      remove a junk/unused tag
GET    /api/admin/listings             every listing incl. closed/archived
GET    /api/admin/users/:handle        user detail + moderation history
POST   /api/admin/users/:handle/sanction   { action: 'board_block'|'board_unblock'|'disable'|'enable', note?, reportId? }
```

Taking down reported content reuses the existing owner-or-admin
`DELETE /api/board/:listingId` and `DELETE /api/board/:listingId/comments/:commentId`
routes — the panel just calls them, then PATCHes the report to `actioned`.
`requireAdmin` sits next to `requireProject` in `worker/api/lib/`.

**Tag merge** is one `DB.batch`: `UPDATE user_interests SET tag_id = :winner
WHERE tag_id = :loser` (with `ON CONFLICT(user_id, tag_id) DO NOTHING` for
people who had both), recompute `interest_tags.usage_count` for the winner,
`DELETE FROM interest_tags WHERE slug = :loser`.

**Board card bundle** — what `GET /api/board` and the listing detail return per
listing, all visible pre-acceptance:

- `headline`, `help_wanted`, `status`, listing `created_at`
- project `title` and project `created_at`
- `step_count` / `step_done` — leaf-only, reusing the `NOT_CONTAINER` subquery
  pattern from `worker/api/projects/index.js:12`
- `upcoming_steps` — up to 3 open leaf steps ordered by `due_date` (nulls last),
  `{ title, due_date }` only

Nothing else about the project (description, journal, supplies, full step list,
collaborators) is exposed until the requester is accepted as a `viewer`.

**Accept-request transaction** mirrors `resolvePendingInvites` in
`callback.js`: in one `DB.batch`, set the request `status='accepted'` +
`decided_*`, and `INSERT INTO project_collaborators (project_id, user_id,
'viewer') ON CONFLICT DO NOTHING`. Then a `contributor_decided` notification.

**Account-deletion guard:** refuse (409) while the caller owns a project that
has other collaborators or an open listing. They must transfer or close first.
`projects` cascades from `owner_id` today, so an unguarded delete would wipe a
shared project and everyone's access with it.

## Notifications

- Written to `notifications` on: new follower, contributor request (to owner),
  request decided (to requester), comment on your listing (to owner), reply to
  your comment (to parent author). Skip if actor is blocked by recipient or
  recipient's `notif_prefs` disables that type.
- **Immediate mode:** send the email in `ctx.waitUntil()` right after the
  insert, using the existing Resend helper (generalize `sendMagicLink` into a
  `sendEmail(env, {to, subject, text, html})` in `worker/api/lib/email.js`).
  Stamp `emailed_at`.
- **Weekly-digest mode:** a Cron Trigger (add to `wrangler.jsonc`) fires
  **Sunday 08:00 PT**, site-wide. Cloudflare cron is UTC-only with no DST: use
  `0 15 * * 0` and accept a one-hour drift across the DST boundary (08:00 PDT /
  07:00 PST), or nudge the entry twice a year. It groups each user's rows with
  `emailed_at IS NULL` (and `mode='weekly'`), sends one summary email, stamps
  `emailed_at`. Up to a week of activity per mail: group by type, cap the
  detail lines, link to the app for the rest.
- `notif_prefs` default: `{ mode: 'immediate', types: { follow: true,
  contributor_request: true, contributor_decided: true, board_comment: true,
  board_reply: true } }`. `mode` is one of `immediate` | `weekly` | `off`.
- In-app: unread count from `notifications` in the app header; a dropdown list.
  Independent of `mode` — turning email off doesn't stop in-app notifications.

## Moderation

- **Listing owner:** delete any comment on their listing; decline or leave
  pending any contributor request; block a user (hides that user's comments and
  requests on all the owner's listings, via the block check).
- **Comment author:** edit or soft-delete their own comment.
- **Admin (`users.is_admin = 1`, set by hand in the D1 console):** an **admin
  panel** view in the Brambletally client, rendered only when
  `me.user.is_admin`. It is a client view, not a new Astro route. Sections:
  - **Reports queue** — open reports, each linking to the target and its
    author, with *remove content* (calls the existing board DELETE, then marks
    the report `actioned`), *board block* / *disable* the author, *dismiss*,
    and a resolution note. Every action writes a `moderation_actions` row and
    carries the `reportId` through.
  - **Users** — look up by handle, see the moderation history, apply or lift a
    board block or account disable.
  - **Interest tags** — list by usage, merge two tags, rename a tag's
    label/slug, delete a junk tag.
  - **Listings** — every board listing including closed/archived, with delete.
- **Reporting:** a "Report" control on listings, comments, and profiles →
  `POST /api/reports` with a category (spam / harassment / illegal / other) and
  optional detail. Rows land in `reports`. One open report per
  reporter+target (partial `UNIQUE`). `ADMIN_EMAIL` gets an optional ping on a
  new report; the queue is the system of record.
- **Sanction enforcement:**
  - **Board block** (`users.board_blocked_at` set) — a `requireBoardOk(user)`
    helper (403 with an AUP link) guards `POST /api/board`,
    `POST .../comments`, `POST .../requests`, and the re-request `PATCH`. Read
    routes and `POST /api/reports` are unaffected.
  - **Account disable** (`users.disabled_at` set) — `loadSession` still loads
    the user but flags `disabled: true`; the router 403s every route except an
    allowlist (`/api/auth/me`, `/api/auth/logout`, `/api/settings/export`,
    `DELETE /api/account`). `/api/auth/me` returns the flag so the client can
    render the suspended screen. Data-subject rights (export, delete) stay
    open.
  - Both are timestamps — clearing them lifts the sanction. Both are logged.
- **Rate limits:** one pending contributor request per user per listing
  (enforced by the `UNIQUE`), plus a soft daily cap per user across all
  listings (count `created_at` in last 24h, reject over ~10). Reports are
  capped similarly (~10/day/user). Turnstile on the request and report forms
  for an account's first few board actions.

## Legal + cookies

Static Astro pages under `src/pages/legal/`: `terms`, `acceptable-use`,
`privacy`, `cookies`. Linked from the footer and the sign-in screen.

- **Acceptance gate:** on first login after launch, block the app behind a
  one-screen "agree to the Terms and Acceptable Use" checkbox. Write
  `users.tos_accepted_at` + `tos_version`. Re-prompt when `tos_version` bumps.
- **Acceptable use** — short and board-specific: no harassment, no spam, no
  illegal or infringing content, listing owners' decisions on their own
  listings stand, admins may remove board content, report via the in-app
  control.
- **Cookie notice, not a consent banner.** Current cookies are the session
  (strictly necessary) and Turnstile (security) — both exempt from consent. A
  single dismissible notice linking to the cookie policy is enough. To keep it
  that way: **self-host the Google Fonts** (removes the only third-party
  request — see `src/pages/tools/brambletally.astro:29`), and if analytics are
  ever added use Cloudflare Web Analytics (cookieless).
- **Data export + delete** endpoints (above) are what the privacy page points
  to for data-subject requests.

## Rendering / XSS

Bio, pronouns, display name, interests, social-link values, comments, listing
headline and body, and request messages are all user text shown to other
users. Commit `3a46a5f` already fixed an XSS finding in this codebase.

- Escape on render everywhere (the app builds DOM in JS — keep using
  `textContent` / the existing escape helper, never `innerHTML` with user
  data).
- Social links: accept `https:` only, reject `javascript:` / `data:` /
  scheme-relative; render with `rel="me nofollow noopener"` `target="_blank"`.
- Interest tags: server slugs each label (lowercase, trim, spaces→hyphens,
  fold diacritics), dedupes, caps count (~15) and label length (~30), upserts
  into `interest_tags`. Render the stored `label`, escaped.

## Phasing

**Phase 1 — identity + profile + settings + legal.**
Handle/display-name migration and first-login handle prompt. `user_profiles`,
`user_links`, `interest_tags` + `user_interests` with the tag autocomplete and
the `/api/interests/:slug` discovery list. Profile view + edit. Settings shell:
notification prefs (stored, even before notifications send), email change, data
export, account delete with guard. `user_blocks` + block/unblock (enforced
wherever it applies as later phases land). `board_blocked_at` + `disabled_at`
columns; the `disabled_at` gate in `loadSession` / the router as an emergency
stop. A minimal admin tag tool (`requireAdmin` helper + merge/rename/delete) so
tag cruft is fixable from day one — the rest of the admin panel waits for
Phase 3. Legal pages + acceptance gate + cookie notice. Self-host fonts.
Avatars: initials only for now.

**Phase 2 — following.**
`follows`. Follow/unfollow, follower/following lists on the profile.
`GET /api/feed` (all default + "Following" filter, followed users marked).
Block enforcement in follow + search. Collaborator-invite picker gains a
"people you follow" source.

**Phase 3 — board + notifications.**
`project_listings`, `listing_comments`, `contributor_requests`. Board list +
detail views. Comment (one-level replies). Contributor request → accept
transaction → `viewer` collaborator. Board card bundle (title, created date,
task summary, next 3 due steps). `notifications` table, in-app unread count,
immediate emails via the generalized `sendEmail`, weekly-digest Cron (Sunday
08:00 PT). `reports` + `moderation_actions` tables, `POST /api/reports` +
Report controls on listings/comments/profiles. Full admin panel: reports
queue, users lookup + sanction (board block / disable), listings takedown
list (tag tools already exist from Phase 1). `requireBoardOk` on board write
routes. Rate limits + Turnstile on first board actions.

**Phase 4 — R2 media.**
Stand up the R2 bucket + binding. Upload endpoint with a server-side size cap.
Profile avatars. `project_photos` table + gallery on the project detail view
(editors upload, viewers see). Per-project photo cap (10 free / 30 supporter).
`Cache-Control: immutable` on delivery; reads proxy through the Worker for the
permission check (bucket stays private). Project delete sweeps
`projects/<projectId>/*` from R2 — the FK cascades the rows, not the blobs.

**Resize approach.** Client-side `<canvas>` resize to ~1600px on the long edge,
q80, before upload; the server rejects anything over 2 MB. Trusted enough
behind the login wall for now. Swap in an in-Worker re-encode (Photon/WASM)
when the app moves to Workers Paid — that plan's 30s CPU ceiling is what makes
a server-side encode of a full photo safe. iPhone Safari canvas resize is the
main path and holds up.

## Open questions

None blocking. Two small calls to make during Phase 3 build:

1. **Disabled user's existing board content** — hidden from others while
   disabled (needs a `disabled_at IS NULL` clause on every public read of a
   listing/comment author), or left visible and only removed item-by-item?
   Draft: left visible; the admin removes specifics. Hiding is a later toggle
   if it's wanted.
2. **Report ping channel** — `ADMIN_EMAIL` immediate on every new report, or
   roll reports into the same Sunday digest for the admin account? Draft:
   immediate, since a report is the one thing you want to see fast.
