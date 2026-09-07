# Brambletally — Build Plan

Rebranded, self-hosted version of "noodlr" (a craft-project tracker) for
Rayhana's Repositorium's Tools section, restructured around GTD (Getting
Things Done) and extended to cover A&S projects, personal research, and
Kingdom Chatelaine office work, with login and shared/collaborative projects.

Repo: github.com/meggyk13/rayhanas-repositorium
Site: Astro, static output, deployed on Cloudflare Pages.

## Stack decisions

- **Backend:** Cloudflare Pages Functions (`/functions` folder in the same
  repo — deploys with the existing Pages project, same domain, no CORS).
- **Database:** Cloudflare D1 (SQLite). Schema: `brambletally_schema.sql`
  in repo root. D1 binding name is `DB`; database name `brambletally-db`.
- **Auth:** Magic-link email, no passwords stored anywhere.
- **Bot protection:** Cloudflare Turnstile on signup/login.
- **Email delivery:** Resend (free tier) for sending magic links.
- **Frontend:** Astro stays static. Brambletally's UI is client-side JS
  calling the Pages Functions API — no change to Astro's build mode needed.

## Naming

Product name: **Brambletally**. Rename all "noodlr" branding, copy, and the
"noodle" session terminology throughout. (Earlier drafts used "Defter" —
fully replaced.)

## Feature scope (from noodlr, keep/cut/add)

**Keep the shape of:**
- Projects with steps, supplies, deadlines, a journal/timeline
- Focus-timer ("noodle") session mode — rename, keep the mechanic
- Card-based project list UI, dark/light theme support

**Cut entirely (noodlr's version of it):**
- noodlr's `IS_PREMIUM` / `FREE_LIMIT` / lock overlays / upgrade prompts /
  demo-mode toggle — all removed from the port.

**Tiers — now being planned (updated 2026-09-07):**
- `users.plan` column exists (`DEFAULT 'free'`), surfaced in `/api/auth/me`.
  **Nothing is gated yet.** No Stripe, no billing UI.
- Full design: the **Supporter tier** section in `docs/social-plan.md`. A
  $10/year plan, scaffolded with social Phase 1 (`isSupporter()` helper,
  badge, inert Settings section, admin manual-grant); billing deferred until
  there are users who might pay. Gates: project photo count, uploaded vs
  initials avatar, immediate vs digest email, active board-listing count,
  profile badge — never the core project/step/collaboration features. Adding
  payment later is additive — no schema rework.
- Not needed for cost: Cloudflare Workers + D1 free tier covers this site for
  a long time; the $5/month Workers Paid plan is the escape hatch.

**Add (GTD structure):**
- Project **category** (revised 2026-09-06 — was a fixed Office/Research/A&S
  `project_type`): a per-user managed pick list (`categories` table),
  starter set A&S / Research / Office / Event prep / Household, add-your-own
  inline, optional per project (`projects.category` denormalized name).
  Filterable on the home screen.
- Status set: Active, Waiting For, Someday, Paused, Done (add "Waiting For"
  to noodlr's existing set)
- ~~Step-level `context` tag~~ — dropped 2026-09-06, didn't fit the work.
- A capture/inbox: quick-add box for unsorted items, separate from
  projects. Each item can be processed into a new project or dropped into
  an existing project as a step.
- A weekly-review view: filtered screen showing everything Active or
  Waiting For, grouped for a GTD-style review pass

**Add (collaboration):**
- Multi-user projects via `project_collaborators` (owner/editor/viewer)
- Invite by email — works whether or not the invitee has an account yet
  (`pending_invites`, resolves on first login with matching email)
- Invite by searching existing users, too (both methods supported)
- One-click ownership transfer — old owner drops to **editor**, not viewer
  (`ownership_transfer_log` keeps an audit trail)
- Same collaboration model applies to saved gate calculator events
  (`gate_event_collaborators`, parallel to `project_collaborators` since
  gate events aren't projects). The calculator itself stays usable without
  logging in; **saving** an event and its log requires a login (user
  decision, 2026-09-06).

**Add (tie-ins to existing tools):**
- `saved_patterns`: save kaftan/şalvar generator inputs so measurements
  don't need re-entering
- Gate calculator event history (`gate_events`, `gate_log_entries`) lives
  in the same login/collaboration system as everything else — this was a
  deliberate choice despite the financial-data sensitivity, confirmed with
  the user. No separate/lighter-touch handling was requested. The unsaved
  calculator works logged-out; a signed-in user can save the current event
  to their history and share it with collaborators.

## Schema

Full D1 schema already written: `brambletally_schema.sql`. Covers all tables
above. One thing NOT enforced at the SQL level, flagged for the app layer:
`projects.owner_id` should always have a matching `role='owner'` row in
`project_collaborators` — D1/SQLite can't express that as a constraint
cleanly, so this needs to be enforced in the API code (e.g., always
insert/update both in the same transaction).

## Decisions (were open questions — resolved 2026-09-06)

1. **Resend + Turnstile:** not set up yet. User is provisioning both; API
   code no-ops each with a console warning until its secret is present.
2. **Session length:** 30-day sliding — each authenticated request extends
   it. No separate "remember me".
3. **Viewers + journal:** viewers CAN read the journal/timeline; editors
   and up can post.
4. **Office-type projects:** no restriction. "Office" is a personal filter
   tag anyone can put on their own project.
5. **Config sanity-check:** done. Astro output is `static` (no adapter).
   The Pages project is Git-connected (build `npm run build`), so
   `/functions` auto-deploys and D1 is bound in the dashboard. The existing
   `wrangler.jsonc` is written Workers-static-assets style and is not read
   by the Git-connected Pages build — left as-is.

## User's working style (context for Claude Code)

- Builds/edits primarily on iPhone; deploys via GitHub web interface
  (github.dev) or GitHub mobile app. Laptop used for heavier operations.
- Prefers plain, direct language. Challenge-first advisory style —
  confidence-tagged claims, no filler openings.
- Iterative: lock requirements in discussion before building, then targeted
  edits rather than wholesale rebuilds/rewrites.
- Editorial standard for any user-facing copy: short declarative sentences,
  no "not only X but also Y," no "In conclusion," no templated openings.
- Astro CSS scoping gotcha: JS-built DOM children need `:global()` wrappers.
- Build verification pattern for this repo: 31 pages = correct build
  (deployment sanity check, not related to Brambletally specifically, but a
  useful thing to know when touching the Astro build).

## Build progress

- Backend (Pages Functions, `functions/api/`): auth (magic link, 30-day
  sliding session), projects + steps + supplies + journal + collaborators +
  ownership transfer, weekly review, inbox, user search, saved patterns,
  gate events + log + sharing. All inert until the `DB` binding exists.
- Next: Phase 2 provisioning (D1 + Resend + Turnstile in the dashboard),
  then the frontend port from noodlr's single `index.html` into
  `public/brambletally/app.{js,css}` + `src/pages/tools/brambletally.astro`
  + a `src/data/tools.ts` entry.

## Planned: Bash + step time estimates (spec'd 2026-09-07)

Two related additions to steps: **bash** (break one step into sub-steps) and
an optional **time-needed** estimate per step, plus a "Quick tasks" view on
the home screen that sorts by it. Approach B from discussion: one real
parent link, not string-prefixed titles. Four smaller ride-alongs go in the
same pass (see "Ride-alongs" below): `completed_at`, estimate rollup on the
project card, multi-line quick-add, due-date preset chips.

### Schema — one migration

`migrations/0001_step_bash_estimate.sql` (and fold all three columns into
`brambletally_schema.sql` for fresh installs):

```sql
ALTER TABLE project_steps
  ADD COLUMN parent_step_id TEXT REFERENCES project_steps(id) ON DELETE CASCADE;
ALTER TABLE project_steps
  ADD COLUMN estimate_minutes INTEGER;   -- nullable; NULL = no estimate
ALTER TABLE project_steps
  ADD COLUMN completed_at TEXT;          -- ISO datetime; set when completed flips to 1
CREATE INDEX idx_steps_parent ON project_steps(parent_step_id);
```

`ON DELETE CASCADE`: deleting a container removes its children. Existing
rows get `NULL` for all three — no backfill. Rows already completed keep
`completed_at = NULL` (unknown), which the review stats treat as "not this
week".

### Bash behaviour

- Hammer button on every open, top-level step (`stepRow`,
  `public/brambletally/app.js:1176`). Tooltip "Break into steps".
- `openBashForm`: a textarea, one sub-step per line. Submit creates one
  child row per non-blank line, `parent_step_id` = this step, incrementing
  `sort_order`.
- The parent becomes a **container**: `completed` is derived (all children
  done → parent reads as checked); its own checkbox is display-only;
  tapping the body still opens its edit form so due date / notes stay
  editable.
- Depth cap: **one level** for v1. No hammer on a step that already has a
  `parent_step_id`.
- Child title stored bare ("cut out pieces"). The breadcrumb
  "sew a caftan &rsaquo; cut out pieces" is composed at display time in the
  flat views (search, Next, Review) — never stored.

### API

- `POST /api/projects/:id/steps` — accept optional `parent_step_id`
  (validate: same project, and itself top-level) and optional
  `estimate_minutes` (must be one of the allowed values below, else 400).
- New `POST /api/projects/:id/steps/:stepId/bash`, body `{ titles: [] }` —
  one `DB.batch`: insert all children + `touchStmt`. Returns the refreshed
  step list. Saves N round-trips from the phone.
- `PATCH .../steps/:stepId`:
  - add `estimate_minutes` to the `pick` whitelist
    (`worker/api/projects/id/steps/stepId.js:13`).
  - reject a direct `completed` write to a container step (400) —
    completion is derived.
  - when `completed` flips to 1, also set `completed_at = datetime('now')`;
    when it flips back to 0, set `completed_at = NULL`. Handled server-side
    in the PATCH, not sent by the client.
  - when a child's `completed` flips, recompute the parent in the same
    batch: parent `completed = 1` (and `completed_at`) iff it has no
    incomplete children; clear both otherwise.
- `DELETE .../steps/:stepId` — container delete cascades (FK). Frontend
  confirm copy: "and its N sub-steps".

### Counts stay leaf-only

Containers must not inflate progress. In the two COUNT subqueries
(`worker/api/projects/index.js:12`, `worker/api/search.js:16`):

- count only steps that are **not** a parent of any other step:
  `WHERE s.id NOT IN (SELECT parent_step_id FROM project_steps
   WHERE parent_step_id IS NOT NULL)`.

`review.js` and `id.js` return every row (add `parent_step_id` and
`estimate_minutes` to their SELECT column lists — `review.js:22` is an
explicit list) so the frontend can nest and sort; the frontend drops
containers from any "open step" tally.

### Time-needed slider

- Stepped `<input type="range">` in `openStepForm`
  (`public/brambletally/app.js:1204`), below Notes, with a live label.
  Stops, left to right: **&mdash;** (unset), 5m, 15m, 30m, 1h, 2h, 4h,
  day+. Allowed stored values: `NULL, 5, 15, 30, 60, 120, 240, 480`
  (480 = "day+").
- Leaf/plain step: slider is editable. Container step: no slider — show the
  **sum of children estimates** as a read-only "&approx; 2h 30m".
- `stepRow` sub-line: append `&middot; ~15m` when an estimate is set.

### "Quick tasks" on Home

- Small toggle in the home header near the status tabs
  (`public/brambletally/app.js:475`): **Projects | Quick tasks**.
- **Quick tasks** swaps the card grid for a flat list of open **leaf**
  steps across **Active + Waiting For** projects that *have* an estimate,
  sorted by `estimate_minutes` asc then due date. Unestimated steps are
  excluded — that is the point of the view.
- Rows reuse the `nextRow` component (title, project name, `~15m` on the
  sub-line); tap opens the project, checkbox completes inline.
- Cap chips: **&le;15m &middot; &le;30m &middot; &le;1h &middot; all**,
  default &le;30m.
- Data source: `API.review()` already returns active + waiting with
  `open_steps`; it just needs the two new columns in that payload.

### Ride-alongs (same pass)

**1. `completed_at` → real weekly-review stat.**
Column above. `review.js` returns `active`/`waiting` only; add a
`done_this_week` count to its payload — completed steps whose
`completed_at >= start-of-week` across the user's projects. Surface it in
the Next / Review header where `doneThisSession` is teased now
(`public/brambletally/app.js:1665`), so the number survives a reload.

**2. Estimate rollup on the project card.**
`projects/index.js` is already being edited for leaf-only counts. Add a
subquery: sum of `estimate_minutes` for open leaf steps. Card meta line
becomes `2/8 steps · ~3h left` (`public/brambletally/app.js:555`); omit the
`~Xh left` clause when the sum is 0/NULL.

**3. Multi-line quick-add for steps.**
The `openBashForm` parser (textarea → array of non-blank lines) is reused
here. Add a persistent `+ add a step` input at the bottom of `stepsPanel`
(`public/brambletally/app.js:1143`): submits on Enter via `API.addStep`,
clears, keeps focus for the next one; a pasted multi-line value creates one
step per line (loop `addStep`, or hit `.../steps/bash`-style batch without a
parent). No modal for the common case.

**4. Due-date preset chips in the step form.**
In `openStepForm` (`public/brambletally/app.js:1204`), above the raw date
input: chips **Today · Tomorrow · This weekend · Next week · Clear** that
write the computed ISO date into the existing `due_date` field. Frontend
only.

### Loose ends

- Focus timer holds a `stepId` (`public/brambletally/app.js:1859`); if that
  step becomes a container mid-session, fall back to its existing "no step"
  path.
- Breadcrumbs for child steps in search / Next / Review results so a bare
  "cut out pieces" is not context-free.

### Build order

1. ✅ Migration (`parent_step_id`, `estimate_minutes`, `completed_at`) +
   `brambletally_schema.sql`. — `migrations/0001_step_bash_estimate.sql`.
2. ✅ API (done 2026-09-07):
   - `STEP_ESTIMATES` in `worker/api/lib/validate.js`;
     `parentRollupStmt` in `worker/api/lib/projects.js` (correlated-subquery
     UPDATE — runs *after* the child write in the same batch; preserves
     `completed_at` while done, stamps it on the transition, clears it on
     reopen; an emptied container reverts to a plain open step).
   - `steps.js` POST: optional `parent_step_id` (must be same-project and
     top-level) + `estimate_minutes` (whitelist); a new open child forces
     the parent back to open.
   - `stepId.js` PATCH: `estimate_minutes` in the whitelist; container steps
     reject direct `completed` / `estimate_minutes` writes (400);
     `completed_at` stamped/cleared server-side; parent rolled up when a
     sub-step's done-state moves. DELETE: sub-steps removed explicitly
     (not trusting the ALTER-added self-FK on prod) + parent roll-up.
   - New endpoint `POST .../steps/:stepId/bash` (`.../stepId/bash.js`,
     registered in `routes.js`): body `{ titles: [] }`, ≤40, one batch,
     returns the full step list.
   - `review.js`: `parent_step_id` + `estimate_minutes` on the open-steps
     SELECT; `done_this_week` = steps the user completed in the last 7 days
     (rolling window, not a calendar week).
   - Leaf-only counts in `projects/index.js` (+ `open_estimate_minutes`
     sum) and `search.js`; `search.js` step results carry `parent_step_id`
     + `estimate_minutes` for breadcrumbs later.
   - `id.js` needs no change — it already `SELECT *`s the step rows.
   - Verified against SQLite (schema load, incremental ALTER, roll-up
     transitions, leaf counts, cascade).
3. ✅ Frontend — steps (done 2026-09-07, `public/brambletally/app.{js,css}`):
   - `stepTree()` / `withoutContainers()` helpers; `fmtDuration()`;
     `STEP_ESTIMATES` mirror of the server list.
   - `stepsPanel` builds the tree; `stepBlock` renders a top-level step with
     its sub-steps indented under `.substeps`; `stepRow` takes
     `{ kids, isChild }` — container checkbox is disabled/dashed and its
     sub-line shows `x/y done` + `≈ <sum>`; leaf rows show `~<est>`; a 🔨
     button on every non-child row (append mode when it's already a
     container).
   - `openStepForm`: due-date chips (Today / Tomorrow / This weekend /
     Next week / Clear) writing into the existing date field; a 0–7
     `<input type=range>` "time needed" slider with a live label. Container
     edits omit the slider and never send `estimate_minutes` (server would
     400). Delete now routes through `btConfirm` with sub-step warning.
   - `openBashForm`: textarea, one line per sub-step, → `API.bashStep`.
   - `quickAddRow`: 1-row textarea at the foot of the list, Enter adds and
     keeps focus, pasted multi-line adds one step per line.
   - `renderProject` progress + focus-session step list are leaf-only.
4. ✅ Frontend — cross-project views (done 2026-09-07):
   - Home header `Projects | Quick tasks` toggle (`state.homeMode`);
     `renderQuickTasks` = estimated open leaf steps across Active + Waiting,
     shortest-first, with `≤15m / ≤30m / ≤1h / All` cap chips
     (`state.quickCap`, default 30).
   - `~Xh left` on the project card from `open_estimate_minutes`.
   - `done_this_week` in the Next count line and a `.bt-review-stat` line in
     the weekly review.
   - Container rows filtered out of the Due-now band, Next buckets, Review
     lists, and focus session; estimate shown on Next / Review rows.
   - Verified: `node --check`, `npm run build` (32 pages), app boots clean
     in `astro dev` (API 404s expected — no D1 locally).
5. ✅ Breadcrumbs for sub-steps in the flat views (done 2026-09-07):
   - `crumb(title, parentTitle)` helper → `<span class="bt-crumb">parent ›</span>
     title`, or the bare title when there's no parent.
   - Next / Review / the home Due-now band resolve the parent title from a
     `Map(id → title)` built off that project's `open_steps` (a container
     with an open child is always in that list, so the lookup always hits).
   - `search.js` gains `LEFT JOIN project_steps parent` →
     `parent.title AS parent_title`; the search result rows use `crumb()`
     and now also show `~<est>`.

**To apply the migration** (D1 binding must exist):
`npx wrangler d1 execute brambletally-db --remote --file=./migrations/0001_step_bash_estimate.sql`

### Later (agreed 2026-09-07, not this pass)

- **Step reordering** — `sort_order` exists and PATCH accepts it; needs
  up/down handles in `stepsPanel` (drag is too fiddly on the phone). The
  bash work adds child ordering, so revisit right after.
- **Move a step to another project** — PATCH takes a new `project_id` with a
  permission check on both sides; moving a container moves its children too.
- **Recurring steps** — needs a `recurrence` field + regen-on-completion.
- **Step-level blocked / waiting-for flag** — its own GTD design call.

## Planned: Project links (spec'd 2026-09-07)

A per-project link list — reference material, inspiration, product pages,
shared docs. Separate from supplies (which carry their own single `url` each).
Own pass, ahead of and independent of the social features. Pure text rows, no
R2, no hosting cost.

### Schema — one migration

`migrations/0002_project_links.sql` (fold into `schema.sql` for fresh
installs):

```sql
CREATE TABLE project_links (
  id          TEXT PRIMARY KEY,             -- uuid
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,                -- http(s) only, <= 2000
  title       TEXT,                         -- optional label; UI falls back to hostname
  note        TEXT,                         -- optional "why this matters", <= 500
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_links_project ON project_links(project_id);
```

### API

Two modules mirroring `worker/api/projects/id/supplies.js` +
`.../supplies/supplyId.js`, registered in `worker/routes.js`:

```
GET    /api/projects/:id/links
POST   /api/projects/:id/links            { url, title?, note? }
PATCH  /api/projects/:id/links/:linkId    { url?, title?, note?, sort_order? }
DELETE /api/projects/:id/links/:linkId
```

- Viewer reads, editor writes (`requireProject` at `'viewer'` / `'editor'`).
- URL validation: `https?://` only; reject `javascript:` / `data:` /
  scheme-relative. Trim, cap 2000 chars. A scheme check goes in
  `worker/api/lib/validate.js`.
- POST / PATCH run in a `DB.batch` with `touchStmt`, like supplies.
- **No** server-side page-title fetch and **no** favicon fetch (decided
  2026-09-07) — a blank title renders as the URL hostname (`www.` stripped)
  with a generic link icon.

### UI

A "Links" panel on the project detail view, next to Supplies. Each row: link
icon, title-or-hostname, `note` on the sub-line; tap opens in a new tab
(`rel="noopener noreferrer" target="_blank"`). A persistent `+ add a link`
inline row (paste URL, optional title) — no modal, same pattern as the step
quick-add. Reorder handles later (`sort_order` is already there).

### Build order

1. Migration + `schema.sql`.
2. API — two modules + `worker/routes.js` rows + the URL-scheme check in
   `worker/api/lib/validate.js`.
3. Frontend — the Links panel and inline add row in the project detail view.

## Landing page — shipped in PR #7 (2026-09-07)

Brambletally is its own app and domain now. It needs a real front door instead
of dropping straight to the sign-in form.

**Built:** `APP_PATH` `/` → `/app` in `worker/api/lib/constants.js` and
`public/app.js` (so the magic-link callback and logout land at `/app`).
`src/pages/index.astro` moved to `src/pages/app.astro` (the client shell, keeps
`noindex`). New `src/pages/index.astro` = the landing page — own `<html>`
shell, self-contained styles, self-hosted latin fonts, Bramble palette
(respects `prefers-color-scheme`), **not** `noindex`, with the six sections
below. Four draft legal pages under `src/pages/legal/` (`terms`,
`privacy`, `acceptable-use`, `cookies`) — each carries a "working draft, not
binding yet" banner; real reviewed copy lands with the first-login acceptance
gate (social Phase 1). A load-time `fetch('/api/auth/me')` swaps the sign-in
CTAs to "Open your projects" for signed-in visitors. Build is 6 pages.
Screenshots are dashed placeholder boxes — swap for real captures after the
Pass-1 look is on prod (it now is).

### Public-page exception

The landing page and the legal pages are the deliberate exception to
`social-plan.md`'s login-wall rule — marketing copy, no user data, no abuse
surface. `noindex` lifts on `/` and the legal pages. The app (`/app`) and every
`/api/*` route stay private and `noindex`.

### Routing

The client app has no router today — `state.user === null` just renders the
sign-in form at `/`. Split it:

- `/` → new static `src/pages/index.astro` = the landing page.
- `/app` → the current full-screen client shell (move today's `index.astro`
  content there; the mount div and `app.{js,css}` are unchanged).
- Magic-link callback redirects to `/app` instead of `/`.
- A logged-in visitor who lands on `/` sees an "Open your projects" button — a
  small inline script hits `/api/auth/me` and swaps the hero CTA.

### The page

One scrolling page in the Bramble aesthetic (hedgehog mark, wordmark in
`--font-display`, Alegreya Sans / EB Garamond, Bramble-light default, respects
`prefers-color-scheme`). Sections:

1. **Hero** — mark + wordmark + "a keeping-book for makers", one plain sentence
   on what it is, a "Start your keeping-book" CTA to `/app`, and a picture of
   the project list.
2. **Who it's for** — costuming and A&S, personal research, Kingdom office work,
   event prep, household projects.
3. **How it works** — capture a loose idea, break a project into steps, plan
   focus time, run a weekly review. Small visual per step.
4. **Made to share** — shared projects, viewer/editor roles, hand off the whole
   project.
5. **Yours to keep** — the three themes, works on your phone, free. One
   friendly line on the Supporter tier.
6. **Footer** — sign in, Terms / Privacy / Acceptable use, byline.

### Copy

Plain, warm, direct. **Do not name "GTD"** or other methodology jargon —
describe what the app does. Short declarative sentences (the repo editorial
standard applies).

### Screenshots

Ship now with **placeholders** — framed, captioned boxes (or light CSS/SVG
mockups of the card UI) sized to the real screenshots. Swap in real app
captures after the Pass 1 theme redesign lands, so the shots show the finished
look.

### Build order

1. Move the app shell to `src/pages/app.astro`; point the auth callback at
   `/app`; confirm `app.{js,css}` paths still resolve.
2. New `src/pages/index.astro` — the landing page, self-contained styles in the
   design-system tokens.
3. Legal pages under `src/pages/legal/` (shared with `social-plan.md` — build
   whichever pass gets there first).
4. Swap placeholders for real screenshots post-redesign.

## Planned: Work-session scheduling + calendar (spec'd 2026-09-07)

Plan when you intend to work on a project, and put that on your calendar as
Focus time that links back into the app.

### Schema — one migration

```sql
CREATE TABLE work_sessions (
  id          TEXT PRIMARY KEY,             -- uuid
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  step_id     TEXT REFERENCES project_steps(id) ON DELETE SET NULL,  -- optional
  starts_at   TEXT NOT NULL,                -- ISO datetime
  ends_at     TEXT NOT NULL,                -- ISO datetime
  note        TEXT,                         -- optional, <= 500
  status      TEXT NOT NULL DEFAULT 'planned'
                CHECK(status IN ('planned','done','skipped')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_work_sessions_user ON work_sessions(user_id, starts_at);
CREATE INDEX idx_work_sessions_project ON work_sessions(project_id);
```

Scope: **project-level, with an optional `step_id`.** The focus deep link still
lands on a step when one is attached.

Add to `users`: `calendar_token TEXT` (random, regenerable) for the feed URL.

### API

```
GET    /api/projects/:id/sessions                 sessions for this project
POST   /api/projects/:id/sessions                 { startsAt, endsAt, stepId?, note? }
PATCH  /api/projects/:id/sessions/:sessionId      { startsAt?, endsAt?, stepId?, note?, status? }
DELETE /api/projects/:id/sessions/:sessionId
GET    /api/sessions?from=&to=                    all the caller's sessions in a range (home view)
GET    /api/calendar/:token.ics                   per-user ICS subscription feed (no auth cookie; token is the key)
POST   /api/settings/calendar-token              regenerate the token
```

Editor+ to create a session on a project; the session's `user_id` is the
caller (each collaborator plans their own).

### Calendar — no OAuth

Two paths, both offered:

1. **Per-event "Add to calendar"** — the default control on a planned session.
   Emits a single-event `.ics` download *and* a "Add to Google Calendar"
   template link (`calendar.google.com/calendar/render?action=TEMPLATE&…`).
   One tap, no setup, no sync. This is the primary mobile path.
2. **Per-user ICS subscription feed** — `GET /api/calendar/:token.ics` returns
   all upcoming `planned` sessions as a `VCALENDAR`. Subscribe once, stays in
   sync. Lives in **Settings → Calendar** with a copy button and regenerate.

**Mobile reality (why both):** an iOS user can tap a `webcal://` link and
subscribe in one step, but a Google Calendar user has to add the feed URL from
Google Calendar *on the web* first — the Google Calendar mobile app can't add a
subscription. Subscribed feeds also refresh on the calendar app's own schedule,
so a session you just planned may not show for a while. The per-event add is
immediate and universal; the feed is the "set once, forget" option for people
who want it.

Each `VEVENT`: `SUMMARY:Focus — <project title>`, `DTSTART`/`DTEND`, and
`URL` + `DESCRIPTION` carrying the deep link
`https://brambletally.com/app?focus=<sessionId>`.

### Deep link back into the app

The app reads `?focus=<sessionId>` on load — same mechanism as the existing
`?auth=invalid` check (`public/app.js:346`). It opens that project and starts
the Focus (candle) screen pre-set to the session's `step_id` when present. This
is the "links back to the app" payoff.

### UI

- **Plan focus time** — a control on the project detail view. Date (reuse the
  Today / Tomorrow / This weekend / Next week chips from `openStepForm`), start
  time, duration (reuse the estimate stops: 15 / 30 / 60 / 120 / 240 min),
  optional note.
- **Upcoming** sessions listed on the project.
- **Home** — a "Planned" line near the status tabs: *"Next: Blue wool
  overdress · Sat 2:00–4:00pm"* with a "Start now" that jumps into the Focus
  screen.
- **Settings → Calendar** — the subscription URL, copy button, regenerate.
- On Focus-session completion, if a `planned` `work_session` for that
  step/project overlaps now, offer "mark planned session done".

### Later

- Reminder email before a planned session — rides the `social-plan.md`
  notification system (Resend) once it exists.
- Recurring sessions.

### Build order

1. Migration (`work_sessions` + `users.calendar_token`) + `schema.sql`.
2. API — the sessions CRUD, `GET /api/sessions`, the `.ics` feed, token
   regenerate.
3. Frontend — Plan-focus-time control, project + home surfacing, Settings →
   Calendar, `?focus=` handling on load.
