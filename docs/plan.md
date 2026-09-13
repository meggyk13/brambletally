# Brambletally — Build Plan

Rebranded, self-hosted version of "noodlr" (a craft-project tracker),
restructured around a capture → break-down → focus → weekly-review loop, with
magic-link login and shared/collaborative projects.

**Audience (revised 2026-09-08):** any maker with long projects — sewing and
costuming, personal research, event prep, household work, admin. The app grew
out of SCA use (A&S, Kingdom-office work) and keeps a hedgerow/medieval visual
identity by choice, but the product is no longer SCA-specific and the copy,
categories, and landing page shouldn't assume that vocabulary. See section A of
the personal-utility batch and `design.md` "Direction".

Repo: github.com/meggyk13/rayhanas-repositorium (now its own repo,
`meggyk13/brambletally`, deployed at brambletally.com)
Site: Astro, static output, one Cloudflare Worker with static assets.

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
  initials avatar, active board-listing count, profile badge, accent colour,
  3 of 6 Pass 3 themes, 10 of 26 project emblems (`design.md` Themes, 3b-5c) —
  never the core project/step/collaboration features. (Email frequency was on
  this list;
  dropped 2026-09-08 — everyone picks Right away / Weekly digest / Never, and
  gating a setting that mostly reduces our own send cost made no sense.) Adding
  payment later is additive — no schema rework.
- Not needed for cost: Cloudflare Workers + D1 free tier covers this site for
  a long time; the $5/month Workers Paid plan is the escape hatch.

**Add (capture / break-down / review structure):**
- Project **category** (revised 2026-09-06 — was a fixed Office/Research/A&S
  `project_type`): a per-user managed pick list (`categories` table),
  add-your-own inline, optional per project (`projects.category` denormalized
  name). Filterable on the home screen. **Starter set revised 2026-09-08**
  (section A of the personal-utility batch) to
  `Making / Research / Event prep / Household / Admin` — the old
  `A&S / Research / Office / Event prep / Household` seed read as SCA jargon.
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
4. **Office-type projects:** no restriction — categories are just personal
   filter tags anyone can put on their own project. (The default `Office`
   category was renamed `Admin` on 2026-09-08; the point stands.)
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

## Project links — shipped in PR #8 (2026-09-07)

A per-project link list — reference material, inspiration, product pages,
shared docs. Separate from supplies (which carry their own single `url` each).
Pure text rows, no R2, no hosting cost.

**Built:** `project_links` table + `migrations/0002_project_links.sql` (folded
into `schema.sql`). `httpUrlOrNull` / `trimOrNull` in `worker/api/lib/validate.js`.
Two worker modules mirroring supplies — `worker/api/projects/id/links.js`
(GET + POST) and `.../links/linkId.js` (PATCH + DELETE), viewer-reads /
editor-writes, `DB.batch` + `touchStmt`; registered in `worker/routes.js`.
`id.js` adds `links` to the detail bundle. Frontend: a **Links** detail tab
between Supplies and Timeline — `linksPanel` / `linkRow` (link icon,
title-or-hostname as the link, note or hostname on the sub-line, edit chevron)
/ `openLinkForm` modal / a persistent "Paste a link…" inline row. New `link`
icon; `linkHost()` strips `www.` and the path. No title/favicon fetch.

**Migration to run against prod D1 after merge:**
`npx wrangler d1 execute brambletally --remote --file=./migrations/0002_project_links.sql`

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

## Planned: personal-utility batch + project export + category rework (spec'd 2026-09-08)

**Status: A–G built on `personal-utility-batch` (PR #19), rebased onto `main`
after PR #18 merged, 2026-09-08.** Eight feature commits: A category rework,
migration `0013`, B timezone, F archive, C duplicate, G assignee, D reminders +
email-default flip, E printable export. Each backend path unit-tested against
`node:sqlite`; B/C/F/G/E browser-verified against `wrangler dev` (incl. after
the rebase). **H (inline editing) built on `h-inline-editing`, off `main`
post-#19, 2026-09-08** — seven frontend commits: the `inlineEdit` / `popover`
helpers, then step title, step due-date, step estimate, project title,
project status + category, project description. Journal-entry edit was
**dropped** from H (it would need a new journal PATCH route, and H is
frontend-only); revisit separately. **Still open:** run
`migrations/0013_personal_utility.sql` against prod D1 after merge; E's
`work_sessions`-based "upcoming focus sessions" summary stat is still a TODO
(the table now exists post-#18).

Comes out of the "comparable apps" gap review in the 2026-09-08 session. Six
additions (A–G) in one batch. None of it is social — this is the personal and
small-team side of the app catching up. Ordered so the no-schema piece can land
first.

Reference framing: Todoist / Things (reminders), Trello / Notion (duplicate,
archive), Asana (step assignee), any project tool (a printable). Stash /
materials inventory was **declined** — revisit only if users ask.

### A. Category rework — de-SCA the starter set

Decided 2026-09-08: the app is no longer SCA-specific, so `A&S` and `Office`
(Kingdom-office work) in the seeded starter set read as jargon.

- **New seed:** `worker/api/categories/index.js` `DEFAULTS` →
  `['Making', 'Research', 'Event prep', 'Household', 'Admin']`.
  `Making` replaces `A&S`; `Admin` replaces `Office`.
- **No migration.** Confirmed no real users yet, so nothing to rename. Only the
  lazy-seed for brand-new users changes. Anyone can still add `A&S` etc. as
  their own category — the pick list is user-managed and unchanged.
- **Landing page** `src/pages/index.astro` (~L200–212): rewrite the `#who`
  intro and the `.kinds` list to drop "Arts &amp; Sciences" and "Kingdom
  office and Chatelaine". New kinds list mirrors the seed:
  Making · Research · Event prep · Household · Admin. Keep the repo editorial
  standard (short declarative sentences, no methodology jargon).
- **Dev seed** `migrations/seed_dev_next.sql`: update the sample `category`
  values and the `Kingdom A&S display board` sample title to match the new set
  (low stakes — it's fixture data).
- `src/pages/legal/privacy.astro:59` just lists "categories" generically — no
  change.

No schema, no API shape change. Ship this as its own commit first.

**Amended 2026-09-13:** `Admin` didn't land — still read as office jargon.
Replaced with `Miscellaneous` in `DEFAULTS`, the landing `.kinds` list, and
the homepage Shuffle demo's category picker (see [[shuffle-mainline-editing]]
for the demo). Same "lazy-seed only" scope as above — no rename for anyone
already seeded.

### B. Per-user timezone

Due dates and the Sunday digest are effectively `America/Los_Angeles` today
with nothing to change it. The reminder cron in **D** needs a real per-user
"today" to be useful.

- **Schema** (migration `0013`, folded into `schema.sql`):
  `ALTER TABLE users ADD COLUMN timezone TEXT;` — IANA name
  (`America/Los_Angeles`), nullable. `NULL` → treat as `America/Los_Angeles`
  (today's implicit default); a `DEFAULT_TZ` constant in
  `worker/api/lib/constants.js`.
- `/api/auth/me` returns `timezone` (raw column value, may be null).
- **Endpoint:** `PATCH /api/settings/timezone` `{ timezone }` — new module
  `worker/api/settings/timezone.js`, registered in `worker/routes.js`.
  Validate against `Intl.supportedValuesOf('timeZone')` when available on the
  Worker runtime, else a hardcoded allowlist in `constants.js`; 400 on an
  unknown zone. Writes `users.timezone`.
- **Frontend:** a control in Settings → Account (below display name). A
  `<select>` of common zones + a **Detect** button that fills it from
  `Intl.DateTimeFormat().resolvedOptions().timeZone`. Saves live, toast on
  success. `API.setTimezone(tz)`.
- **Uses now:** the reminder cron (**D**). **Not** rescheduling the weekly
  digest per user — still one Sunday run; note as later. Date *display* is
  already browser-local, so no render change. The `.ics` feed already emits
  UTC — unaffected.

### C. Duplicate a project

Crafters remake the same garment; researchers reuse the same methodology
checklist.

- **Endpoint:** `POST /api/projects/:id/duplicate` — caller must be a
  collaborator on the source at **viewer+** (you can copy something shared with
  you into a project you own).
- **New project:** `owner_id` = caller, `title` = `"<title> (copy)"`,
  `status` = `Active`, `deadline` = `NULL`, `created_at` = now. `category`:
  copy the source string as-is **and** `INSERT OR IGNORE` a `categories` row
  for the caller with that name so the picker shows it.
- **Copies:** `project_steps` (incl. sub-steps — build an old→new id map, remap
  `parent_step_id`), `project_supplies`, `project_links`. **Resets:** every
  step `completed`/`completed_at` → `0`/`NULL`; every supply `acquired` → `0`.
- **Does not copy:** journal, collaborators, board listing, work sessions.
- One `DB.batch`: insert the project, the `role='owner'` collaborator row (the
  plan.md owner/collaborator-in-lockstep rule), then all child rows. Returns
  `{ id }`.
- **Frontend:** "Duplicate" in the project detail overflow menu →
  `btConfirm` → `API.duplicateProject(id)` → navigate to the new project.

### D. Due-date reminders (personal)

"Step due today / tomorrow" reaches you in-app and by email, reusing the
`notifications` + email plumbing built for the board.

**Email-frequency default changes with this batch (decided 2026-09-08).**
`DEFAULT_NOTIF_PREFS.mode` flips `'immediate'` → `'weekly'` in
`worker/api/lib/notif.js`. Out of the box a user now gets **in-app
notifications only, plus the one Sunday digest** — no immediate email. The
three modes are unchanged (`immediate` | `weekly` | `off`); the Settings
control is reframed as a *frequency* choice ("How often should we email you?" —
**Right away · Weekly digest · Never**, default **Weekly digest**). Conservative
"for now" while email volume against Resend's free tier (~100/day) is unproven;
revisit once there's real usage. Also mirrored in `social-plan.md` →
Notifications. Every notification **type** still defaults on — `mode` is what
decides whether/when it emails.

- **New notification type** `step_due`. Add to `NOTIF_TYPES` in
  `worker/api/lib/notif.js` (+ `DEFAULT_NOTIF_PREFS.types.step_due: true`,
  `sanitizeNotifPrefs`). `notifCopy('step_due', …)` in `worker/api/lib/notify.js`:
  subject `Due <today|tomorrow>: <step title>`, line
  `"<step title>" in <project title> is due <today|tomorrow>.`
- **Recipients:** the step's **assignee** when set (see **G**); otherwise the
  project **owner and editors** (dedup; viewers can't complete steps). Most
  projects are solo, so this is normally one person.
- **Which steps:** leaf steps only, `completed = 0`, project not archived and
  `status IN ('Active','Waiting For')`, `due_date` equal to the recipient's
  local **today or tomorrow** (computed from `users.timezone`, `DEFAULT_TZ`
  fallback).
- **Dedup:** store `subject_type='step'`, `subject_id=<step id>`,
  `preview=<due_date>`. Before inserting, skip if a `step_due` row already
  exists for that `(user_id, subject_id, preview)` — so a step re-reminds only
  if its due date *changes*.
- **Delivery:** honours `mode` exactly like every other type — no special
  immediate bypass. The daily cron **always writes the in-app row** (subject to
  `types.step_due !== false` and the `disabled_at` guard; block checks are moot,
  self-scoped). Email then follows `mode`: `immediate` → sent now by the cron
  via `notify()`; `weekly` (the default) → picked up by Sunday's digest;
  `off` → in-app only. A day-before reminder that reaches a default user by
  email only on Sunday is weak — the timely signal for them is the in-app bell.
  A per-type "always email now" override for time-sensitive types is a **Later**
  item.
- **New lib** `worker/api/lib/reminders.js` — `runDueReminders(env)`. It writes
  rows through `notify()` so the immediate-mode email path is reused.
- **Cron:** add `"0 12 * * *"` (12:00 UTC daily) to `wrangler.jsonc`
  `triggers.crons` (keep the Sunday entry). In `worker/index.js` `scheduled()`,
  branch on `event.cron`: `"0 15 * * 1"` → `runWeeklyDigest`; `"0 12 * * *"` →
  `runDueReminders`. Both under `ctx.waitUntil` with a `.catch`.
  (CF day-of-week is 1-7, 1 = Sunday; `0` is rejected on deploy — fixed
  2026-09-09, the digest cron never registered before that.)
- **Settings:** the Notifications section's per-type toggle list gains
  `step_due` ("Reminders for steps due soon"); update the helper text to
  describe the new default (digest only).

### E. Project export — printable + time summary

- **Endpoint:** `GET /api/projects/:id/print` — returns a standalone **HTML
  document** (not JSON), screen + `@media print` CSS inline, so the user does
  Ctrl/Cmd-P → Save as PDF. No server-side PDF library. Viewer+ access.
- **Sections:**
  - Header — title, category, status, deadline, owner display name,
    "Exported <date>".
  - Description / project notes (`projects.pickup_note`).
  - **Summary stats** — `X of Y steps done` (leaf-only) + percent; estimated
    time left (`SUM(estimate_minutes)` over open leaf steps, `fmtDuration`);
    total estimated time (all leaf steps); steps completed with a
    `completed_at` and the earliest→latest span; count + total hours of
    *upcoming* planned focus sessions for the caller.
  - Steps — nested list, `☐` / `☑` glyphs, due date + estimate + notes per
    step.
  - Supplies — table (name, source, cost, `☐`/`☑` acquired) + cost total.
  - Links — title (or hostname) + URL.
  - Journal — **excluded by default**; a `?journal=1` link on the page itself
    ("Include journal entries") reloads with it. No modal.
- Escape every field on the way out (same discipline as `notify.js` /
  `digest.js` — a shared `escapeHtml`).
- **Frontend:** "Print / PDF" in the project overflow menu → opens
  `/api/projects/:id/print` in a new tab.

### Schema — one migration

`migrations/0013_personal_utility.sql` (fold all three columns into `schema.sql`):

```sql
ALTER TABLE users        ADD COLUMN timezone    TEXT;   -- IANA name; NULL = DEFAULT_TZ
ALTER TABLE projects     ADD COLUMN archived_at TEXT;   -- ISO datetime; NULL = active
ALTER TABLE project_steps ADD COLUMN assignee_id TEXT
  REFERENCES users(id) ON DELETE SET NULL;             -- NULL = unassigned (see G)
```

`archived_at` is orthogonal to `projects.status` (see **F**).

### F. Archive vs. delete a project

Kept in the same migration as **B** because it's one small column and the same
list-endpoint edits.

- **Schema:** `projects.archived_at` (above). Orthogonal to `status` — an
  archived project keeps whatever status it had; "Done" stays a workflow
  state, "archived" means shelved out of view.
- **Read:** `GET /api/projects` excludes `archived_at IS NOT NULL`;
  `?archived=1` returns **only** archived. Home status counts, Quick tasks,
  Next, and Review all exclude archived (add the clause wherever
  `worker/api/projects/index.js` / `review.js` scope the owner's/collaborator's
  projects).
- **Write:** `PATCH /api/projects/:id` accepts `{ archived: true|false }` →
  sets/clears `archived_at`. **Owner only** (editors don't shelve someone
  else's project). Archiving also sets any `open` board listing on the project
  to `closed` in the same batch.
- **Frontend:** "Archive" / "Unarchive" in the project overflow menu; an
  "Archived" entry in the Home status-filter row → a `renderArchived` list
  (reuses the card grid) with a per-card Unarchive. Archived projects are still
  openable and editable — just out of the default views.

### G. Assign a step to a person

A lightweight Asana "assignee" — in a multi-person project, a step can be
handed to one collaborator. Single assignee only; no workload view, no
per-person capacity, no reassignment history.

- **Schema:** `project_steps.assignee_id` (in migration `0013` above).
  `REFERENCES users(id) ON DELETE SET NULL` covers account deletion. `NULL` =
  unassigned. Any step row, leaf or container.
- **Who can assign:** editor+ on the project (same gate as editing a step).
  Assignable to **any** current collaborator — owner, editor, or viewer —
  validated against `project_collaborators`; 400 if the target isn't a member.
  (Assigning a viewer is allowed as a signal; you'd usually then bump them to
  editor through the existing collaborators UI.)
- **Collaborator removal cleanup:** `DELETE /api/projects/:id/collaborators`
  also runs `UPDATE project_steps SET assignee_id = NULL WHERE project_id = ?
  AND assignee_id = ?` in the same batch (`worker/api/projects/id/collaborators.js`).
- **API:**
  - `PATCH /api/projects/:id/steps/:stepId` — add `assignee_id` to the `pick`
    whitelist (`stepId.js:13`). Accept a member id or `null`; 400 otherwise.
    The `bash` endpoint is unchanged — new sub-steps start unassigned.
  - `GET /api/tasks?scope=mine` — new module `worker/api/tasks.js` (+
    `worker/routes.js`): open **leaf** steps where `assignee_id` = caller,
    across every project the caller collaborates on, not archived, project
    `status IN ('Active','Waiting For')`. Each row carries project title,
    `due_date`, `estimate_minutes`, `parent_step_id` (for the breadcrumb).
    Sorted `due_date` (nulls last) then `estimate_minutes`.
- **Surfacing:**
  - `stepRow` — an assignee chip (initials via `avatarEl`); an editor sees a
    faint "+ assign" affordance when it's unset. No new query: `id.js` already
    returns the step rows with `assignee_id`, and the project detail already
    loads `collaborators` — resolve the name client-side against that list.
  - Project detail — an "Everyone · Me · <name>…" filter chip row above the
    step list, shown only when the project has more than one collaborator.
  - Home — a **My tasks** mode beside `Projects | Quick tasks` (`state.homeMode`),
    rendering `GET /api/tasks?scope=mine`. This is the cross-project "what's on
    my plate" view — the main payoff of assignment.
  - Quick tasks / Next / Review rows — show the assignee chip when set.
- **Interaction with D (reminders):** a step with an `assignee_id` reminds
  **the assignee only**. Unassigned falls back to owner + editors (D's
  default). One branch in `runDueReminders`.
- **Interaction with E (print):** show the assignee name on each step line.
- **Notification:** new type `step_assigned` — "`<actor>` assigned you
  ‘`<step>`’ in `<project>`". Add to `NOTIF_TYPES` (+
  `DEFAULT_NOTIF_PREFS.types.step_assigned: true`). Fired from the PATCH when
  `assignee_id` changes to someone other than the actor; reuses `notify()`,
  so it honours `mode` — with the 2026-09-08 default (`weekly`) the assignee
  learns of it in-app immediately and by email in Sunday's digest unless they
  chose "Right away". Skipped when you assign yourself.

### Build order

1. **A — category rework.** No schema. `DEFAULTS`, landing copy, dev seed.
   One commit.
2. **Migration `0013`** (`users.timezone`, `projects.archived_at`,
   `project_steps.assignee_id`) + `schema.sql` + `DEFAULT_TZ` / zone allowlist
   in `constants.js`.
3. **B — timezone.** `me` payload, `PATCH /api/settings/timezone`, Settings
   control + Detect button.
4. **F — archive.** List-endpoint filters, `PATCH` toggle, Archived view,
   overflow-menu actions.
5. **C — duplicate.** `POST /api/projects/:id/duplicate`, overflow-menu action.
6. **G — assignee.** `assignee_id` in the step PATCH + membership check,
   collaborator-removal cleanup, `GET /api/tasks?scope=mine`, the step chip +
   project filter + Home "My tasks" mode, `step_assigned` notification.
7. **D — reminders.** Flip `DEFAULT_NOTIF_PREFS.mode` → `'weekly'` and reframe
   the Settings mode control as a frequency choice (do this part first — it's
   independent of the cron). Then `reminders.js`, `step_due` type + copy +
   prefs, the daily cron + `event.cron` branch, per-type toggle. Assignee-aware
   recipient selection (needs G).
8. **E — printable.** `GET /api/projects/:id/print`, overflow-menu link,
   per-step assignee.

**Prod migration after merge:**
`npx wrangler d1 execute brambletally --remote --file=./migrations/0013_personal_utility.sql`

### H. Inline editing (frontend only, no schema, no API change)

**Built on `h-inline-editing` (off `main` post-#19), 2026-09-08.** Helpers plus
six surfaces below. `inlineEdit` gained a `placeholder` option (a field with a
placeholder is clearable; without one an empty value reverts). The chip cluster
was factored into a `dueChips()` helper shared by the popover and
`openStepForm`. Step assignee was already inline (shipped with G,
`openAssigneeMenu`). Journal-entry edit was **dropped** — no journal PATCH
route and H is frontend-only. Supply `acquired` was already a direct toggle.

Today every edit is a `.modal-overlay` (bottom sheet on phones, centred dialog
wider — `public/app.css:1440`). Only `quickAddRow`, `appearanceControls`, and
search suggest are inline. Convert the **frequent single-field** edits to
inline; keep the sheet for create flows and multi-field edits.

Not one commit — each surface below is independent and can land on its own.

#### Two shared helpers (build first)

- **`inlineEdit(displayEl, { value, multiline, validate, onSave })`** — swaps
  the display node for an `<input>`/`<textarea>` sized to match, selects the
  text, commits on Enter (single-line) or blur, cancels on Esc. Empty/invalid
  on blur reverts, never deletes. Optimistic: update the row, call
  `guard(onSave)`, roll back the text on reject. One CSS class pair
  (`.bt-inline` / `.bt-inline.editing`) under a `:global()` wrapper (Astro
  scoping — see the working-style note in `plan.md`).
- **`popover(anchorEl, contentEl, { align })`** — a small anchored panel with
  outside-click / Esc to dismiss. Generalise the mechanic already in
  `openNotifPanel` (`app.js:2944`). Used for enumerated fields (status,
  assignee, estimate, due-date chips).

#### Convert to inline

| Surface | Interaction |
| --- | --- |
| **Step title** | Tap the title → `inlineEdit` in place. The rest of `openStepForm` (notes, estimate, delete) moves behind a `⋯` control on the row. |
| **Step due date** | Tap the "due …" sub-line bit → `popover` with the existing `bt-date-chips` + a native `<input type=date>`. Writes `due_date` directly. |
| **Step assignee (G)** | Tap the assignee chip / "+ assign" → `popover` list of the project's collaborators + "Unassign". This *is* G's assignment UI — build G's chip inline from the start rather than as a modal. (Not to be confused with `openAssignStep`, the inbox→project flow.) |
| **Step estimate** | Tap the "~15m" bit → `popover` with the 0–7 stops (reuse `STEP_ESTIMATE_LABELS`). |
| **Project title** | Tap the header title → `inlineEdit`. |
| **Project status** | A `<select>` styled inline in the header (or a `popover`), `PATCH` on change — no form. |
| **Project category** | Inline `<select>` in the header, same as status; keeps the "＋ New category…" option → falls back to `btPrompt`, not the full sheet. |
| **Project description / notes** | Inline `<textarea>` on the detail view that saves on blur. *(Phone caveat: a bottom-anchored textarea can sit under the keyboard — if it's bad in testing, leave these two in the sheet.)* |
| ~~**Journal entry edit**~~ | Dropped — needs a journal PATCH route; H is frontend-only. Revisit separately. |
| **Supply `acquired`** | Already a direct checkbox toggle (`suppliesPanel`). No change. |

#### Keep as a sheet / dialog

New project (`openProjectForm` create mode — many fields + category creation),
`openBashForm` (multi-line textarea), `openPlanForm` (date + time + duration),
`openSupplyForm` edit (name / source / cost / url — multi-field),
`openListingForm` / `openRequestModal` / `openReportModal` (low frequency),
`openManageCategories`. `openStepForm` stays for the "⋯" path (notes +
estimate + delete in one place) but is no longer the primary tap target.

#### Watch for

- Keep one obvious affordance per row that still opens the full editor (the
  `⋯`), so inline edits don't strand the less-common fields.
- `rerender()` after every inline commit so derived bits (container roll-ups,
  breadcrumb, sub-line) refresh.
- Don't regress the checkbox tap target — `.checkbox` keeps its own
  `stopPropagation` handler; inline edit binds on `.check-title` only.
- All new classes need `:global()` wrappers in the Astro-scoped stylesheet.

### Later (not this batch)

- **Per-type "always email now" override** — a way for a user on the
  `weekly` default to still get immediate mail for time-sensitive types
  (`step_due`, `step_assigned`) without switching everything to `immediate`.
  Deferred with the 2026-09-08 conservative-default decision.
- **Daily digest** as a fourth frequency, piggybacking the reminder cron —
  a middle ground between `immediate` and `weekly`.
- Per-user digest scheduling (send the weekly digest in each user's local
  Sunday morning, not one global run) — needs `users.timezone` from **B**.
- Reminder lead time as a user preference (same-day only vs. 1 / 3 days out).
- Recurring steps (already on the step "Later" list) would pair well with
  reminders.
- Human-readable export as a real server-side PDF once the app is on Workers
  Paid — the print-to-PDF path covers it until then.
- Revisit the email-frequency **default** (`weekly` → maybe `immediate` for
  some types) once there's real usage data against Resend's daily cap.

## Guided onboarding + zero-friction account creation (spec'd 2026-09-12)

**A through F are all built** (2026-09-13) — anonymous "Start your first
project" through claim-by-email, the setup tally, invite-creates-account, and
admin visibility, browser-verified against `wrangler dev`. Not yet deployed.
Notes on what shipped:

- **B:** `users.email` nullable (migration `0016_anonymous_users.sql`, a table
  rebuild — SQLite can't drop `UNIQUE NOT NULL` in place), new
  `POST /api/auth/anonymous` (Turnstile-gated, same as request-link). The
  handle-prompt gate (the "second gate" noted below) is now fixed server-side
  in `worker/api/auth/me.js` — `needs_handle: !user.handle && !!user.email` —
  rather than patched client-side as originally sketched.
- **C:** `magic_links.claim_user_id` (migration `0017_claim_account.sql`, plain
  `ALTER TABLE`, nullable FK). New `POST /api/auth/claim` (no Turnstile — only
  reachable from an authenticated anonymous session). `callback.js` branches
  three ways: normal signup/login (unchanged), in-place claim (`UPDATE users
  SET email=...` on the anon row), and merge-into-existing-account.
  - **Real gotcha hit while building this:** D1 enforces foreign keys at
    *runtime* (a live `env.DB` query from the Worker), even though a
    `wrangler d1 execute` migration file does not — confirmed empirically,
    contradicts the general "D1 doesn't enforce FKs" assumption this repo's
    migrations were written under. The merge path's final `DELETE FROM users`
    therefore has to reassign or null out *every* `REFERENCES users(id)`
    column the anonymous account could hold, not just
    `projects.owner_id`/`project_collaborators` — `project_listings.created_by`
    (board listing), `pending_invites.invited_by` (invited a collaborator),
    `contributor_requests.decided_by`, `ownership_transfer_log.from_user_id`/
    `to_user_id`, and `magic_links.claim_user_id` (the very link being
    consumed). All in one `env.DB.batch()` for atomicity — see
    `mergeAnonymousInto` in `worker/api/auth/callback.js`.
- **F:** Setup tally sits in `detail-topbar` as a `tallySvg`/`tallyLabel`
  badge; tapping it opens a popover (checklist + "Save your project" button —
  chosen over a literal two-separate-controls read of the spec text, since a
  compact topbar slot needs one tap target on mobile). Unchecked items jump to
  their control (steps tab + focus quick-add; focus the category `<select>`;
  click `.detail-desc` into edit mode; open the Edit modal focused on
  deadline). `computeSetupItems()` is recomputed fresh wherever it's read
  (badge, popover, the "first step" toast gate) rather than cached in a
  closure — `refreshDetail()` (steps panel actions) only rebuilds `#bt-panel`,
  not the header the badge lives in, so a stale closure under-reports progress
  after adding a step from the popover's own "Add a step" jump.
- **D:** `collaborators.js` POST's no-existing-account branch now creates the
  `users` row, the `project_collaborators` row, and the `pending_invites`
  audit row in one batch, then mails a sign-in link — matching the spec
  exactly, including stamping `pending_invites.accepted_at` at insert time
  (not left NULL) so the invite doesn't double-list under both "collaborators"
  and "pending invites" in the People panel, and so `resolvePendingInvites` in
  `callback.js` still only touches genuinely-still-pending rows from before
  this change. `/api/auth/me` gained an `invite` field (project title +
  inviter name, via the most recent non-owner `project_collaborators` row)
  computed only while `needs_tos` is true; `renderTos()` shows "\<Name\>
  invited you to collaborate on "\<Project\>"" when it's present.
- **E:** New Admin tab "Anonymous" (`GET /api/admin/anonymous`, admin-gated) —
  every `email IS NULL` user, newest first, with their project title(s)
  (`GROUP_CONCAT`, since nothing stops an anonymous account from starting
  more than one) and how long ago they started. No purge job, per spec.

Today a visitor has to sign in (magic link → check email → click) before
touching anything. Goal: **"Start your first project"** takes them straight
into a real, working project — steps, sub-steps, due dates, estimates,
supplies, links, journal, archive, duplicate, print — with no email at all,
and the email ask only shows up when they choose to save their work for
later or invite someone else in. Locked in discussion 2026-09-12.

### A. Simplify project creation, everywhere

Not onboarding-specific — this replaces today's create form for existing
users too.

- `openProjectForm` (`public/app.js:4076`) splits into a lean **create** path
  and the existing full **edit** path (opened from a project's `⋯`).
- Create asks for **Title** + one-tap **category chips** (`Making · Research
  · Event prep · Household · Admin` — the **A** defaults) instead of the
  dropdown + manage-categories link. No chip picked = `(none)`, same as today.
- Status/Deadline/Description/Project notes **drop off the create form**.
  Status still defaults `Active` server-side (already does). Those fields
  move to Edit only — nothing users can't already do today, just not asked
  for before the project exists.
- Submit goes straight to the project page, same as now.

### B. Anonymous project creation

- **Schema:** `users.email` goes from `UNIQUE NOT NULL` to nullable, with a
  partial unique index — same pattern as `handle` / `calendar_token`
  (`schema.sql:11,27`). No other table changes; every project-owned table
  already cascades from `users.id` (`schema.sql:236,253,287`).
- **CTA:** "Start your first project" shows a required "I agree to the
  [Terms](...)" checkbox next to the button (not a separate acceptance
  screen). Clicking it `POST`s to a new endpoint that creates a `users` row
  (`email = NULL`, `tos_accepted_at = now`, `tos_version` = current) and a
  session, then opens straight into the **A** create form.
- Because `tos_accepted_at` is set at creation, the router's existing
  `needsTos` gate (`worker/index.js:109`) never triggers for this account —
  no special-case exemption needed, it just falls out of the ordering.
- Everything under "projects and steps" works from here on with zero further
  gating, using the existing owner/collaborator permission checks unchanged.

### C. Claiming the account (adding an email later)

This can't be a plain `UPDATE users SET email = ...`, because whoever clicks
the emailed link might not be the same browser/device that built the
project — `callback.js` today has no notion of "which anonymous session
asked for this link," it just signs in whoever clicks.

- **Schema:** add nullable `magic_links.claim_user_id` (`REFERENCES
  users(id)`) — set only on a claim request, `NULL` for ordinary
  login/signup links.
- **Request:** "Save your project" prompts for an email, sends a magic link
  as today but stamps `claim_user_id` = the anonymous user's id.
- **Callback** (`worker/api/auth/callback.js`), when `claim_user_id` is set:
  - Email has no existing account → `UPDATE users SET email = ...` on the
    `claim_user_id` row in place. Session signs into that (now-claimed)
    account.
  - Email matches an existing account → reassign the anonymous user's
    `projects.owner_id` and `project_collaborators` rows onto the existing
    account, delete the anonymous `users` row, session signs into the
    existing account.
- Anonymous session stays fully usable while the link is unclicked — nothing
  blocks on "pending" claim state.

### D. Inviting a collaborator creates their account immediately

Change from today's `pending_invites`-then-wait behavior
(`worker/api/projects/id/collaborators.js:40-50`): inviting by email that
has no matching account now creates the account right away instead of
waiting for that person to sign themselves up.

- On invite: create the `users` row now (`email` set, `tos_accepted_at =
  NULL` — they still owe their own acceptance), create the
  `project_collaborators` row now (so the relationship exists immediately),
  and still insert a `pending_invites` row for attribution — it becomes an
  audit record (`invited_by`, `created_at`) rather than a gate;
  `accepted_at` is no longer what creates the collaborator relationship.
- Immediately generate and email a magic link (reuse `magic_links` +
  `sendMagicLink`) so the invitee has a working sign-in link right away —
  no separate "request a link" step for them.
- `callback.js` needs no change for this path: the `users` row already
  exists by email, so it signs them straight into a session as normal. The
  router's `needsTos` gate then blocks everything except the small allowlist,
  since `tos_accepted_at IS NULL`.
- `/api/auth/me` (or the 403 body the gate returns) needs to surface invite
  context when `needs_tos` is true: look up the most recent non-owner
  `project_collaborators` row for this user, joined to `projects` and the
  inviter's `users` row, so the client renders **"Meg has invited you to
  collaborate on "<Project>"! Accept the Terms to continue"** instead of the
  generic acceptance screen. Accept still goes through the existing
  `/api/legal/accept`.

### E. Admin visibility

- New Admin tab/section: `users WHERE email IS NULL`, `created_at`, and
  their project's title, so drop-off is eyeballable.
- **No purge job yet** — deferred per 2026-09-12 decision; revisit if this
  list gets long enough to matter. Nothing here depends on retention, so
  adding a clear-out cron later is additive.
- **Purge added 2026-09-13** — a human-driven admin action, not a cron: a
  per-row **Delete** and a **Purge older than N days** bulk action on the
  Anonymous tab. `DELETE /api/admin/anonymous/:id` re-checks `email IS NULL`
  server-side (a stale client list can't be used to delete a real account) and
  refuses (409) if the account owns a project with other collaborators.
  `POST /api/admin/anonymous/purge { olderThanDays }` does the same per row,
  capped at 200 accounts per call (returns `remaining: true` if more are left —
  re-run to continue), skipping instead of failing on any row that fails the
  same collaborator check. Both reuse `cascadeDeleteUserStatements` /
  `hasSharedOwnedProjects`, pulled out of `DELETE /api/account` into
  `worker/api/lib/userDelete.js` so the no-cascade `users(id)` reassignment
  (deleted-user placeholder, migration 0018) isn't duplicated a third time.

### Admin panel: overview, audit log, listings search, users list (2026-09-13)

(Not part of the guided-onboarding A–F sequence above — a separate round of
admin-panel work done the same day.)

Three more additions to the admin panel, browser-verified against
`wrangler dev` with seeded local D1 data (a Supporter grant to check the
audit feed; two seeded listings — one open, one closed — to check the
Listings filter/search).

- **Overview tab** (now the panel's default landing tab, ahead of Reports):
  `GET /api/admin/stats` returns one row of counts — open reports, signups in
  the last 7 days, mod actions in the last 7 days, total/anonymous/supporter/
  admin users, listings by status, board-blocked and disabled counts.
  `worker/api/admin/stats.js` excludes the `deleted-user` placeholder
  (migration 0018) from every `users` count via `id != ?1` so it doesn't skew
  the numbers by one. Frontend renders a `.bt-adm-stats` tile grid.
- **Audit tab**: `GET /api/admin/audit?cursor=` — every `moderation_actions`
  row, any admin, any target, newest first, paginated 50/page. Same table the
  Users tab's per-user history already reads, just unscoped — "what has any
  admin done recently" instead of "what's happened to this one account."
  Frontend uses the same Load-more-button pattern as `renderDiscover` /
  `renderFollowList` (button disabled during fetch, removed before appending
  the new page, to avoid the double-click-duplicates-a-page bug fixed in the
  hardening pass).
- **Listings search/filter**: `GET /api/admin/listings` gained `status`
  (open/closed/archived) and `q` (matches headline, project title, or owner
  handle/display name via `lower(...) LIKE`) query params. The frontend tab
  also gained the pagination it was quietly missing — `next_cursor` was
  already returned by the endpoint but nothing called "load more" before
  this pass.
- **Users tab became a browsable list (2026-09-13 follow-up)** — it used to
  be handle-lookup-only (type an exact handle, nothing without one), which
  meant it never actually showed anyone until you searched. New
  `GET /api/admin/users?cursor=&filter=&q=` lists every account (deleted-user
  placeholder excluded) newest first, with `filter` in
  admin/supporter/board_blocked/disabled and `q` matching handle, display
  name, name, or email. Detail and sanction actions stay handle-keyed
  (`GET`/`POST .../users/:handle`, unchanged) — a row with no handle set yet
  (pre-handle signups) shows in the list but isn't clickable into detail,
  same as every other handle-keyed admin surface. Frontend: filter chips +
  search + Load-more list, click a row to open the existing detail card with
  a "Back to list" button that restores the filtered/searched view.

**Second follow-up (2026-09-13), a full per-tab review** — went back through
every tab asking "what's missing," browser-verified each fix against
`wrangler dev` with seeded local D1 data (a fresh report, a board-block
sanction against it, to exercise the new report/target links below):

- **Reports pagination** — had the same quietly-missing-Load-more gap as
  Listings did before its fix, just never caught: `GET /api/admin/reports`
  already returned `next_cursor`, nothing in the frontend used it. Fixed the
  same way — cursor tracking + Load-more button.
- **Anonymous list pagination + search** — this list had no `LIMIT` at all,
  the one admin list that grows without any moderation action behind it
  (anyone can drop off without signing up). `GET /api/admin/anonymous` now
  takes `cursor` (50/page) and `q` (matches a project title via `EXISTS`).
- **Tags pagination + "Unused only"** — `GET /api/admin/interests` had a hard
  `LIMIT 200` with no way past it and no signal you'd hit it; now paginated
  (100/page) and takes `unused=1` to narrow to `usage_count = 0`, the natural
  view for cleanup work.
- **Audit: action-group filter + report/target links** — `GET /api/admin/audit`
  gained `group` (board/account/content/supporter, bucketing the 7 exact
  `action` values into something a chip row can hold). The target user's name
  is now a link into their Users-tab detail card (sets
  `state.adminUsersOpenHandle`, which `adminUsersSection` checks on mount and
  opens directly instead of the list); an entry with a `report_id` shows
  "from a report", linking to Reports/All (a jump to the tab, not a scroll to
  the specific card — there's no single-report view to scroll to yet).
- **Overview: clickable tiles** — every stat tile now sets the matching
  tab/filter state and switches `state.adminTab`, so "Open reports" lands on
  Reports filtered to Open, "Board-blocked" lands on Users filtered to
  Board-blocked, etc., instead of being a dead end.
- **Bug found via a global `input,textarea,select{width:100%}` rule
  (`app.css`)**: the new Tags "Unused only" `<input type="checkbox">` inherited
  it and rendered as a full-width bar instead of a checkbox. Fixed with a
  `.bt-checkbox` override (`width:auto`, native `appearance:checkbox`) rather
  than styling the one input inline, since any future checkbox would hit the
  same rule.
- **`btPrompt` Cancel-vs-empty bug (found this pass, fixed 2026-09-13
  same-day follow-up)** — `btPrompt`'s OK path used to collapse an empty
  input to `null` (`input.value.trim() || null`), the same value Cancel
  resolves with, so no caller could tell "the user backed out" from "the
  user submitted nothing." Every "optional note" call site did
  `(await btPrompt(...)) || null`, which meant Cancel on a report-dismiss,
  sanction, or Supporter-grant note prompt did **not** abort the action, it
  just skipped the note — confirmed by accidentally dismissing a report this
  way. Fixed by changing `btPrompt`'s contract: OK now always resolves the
  trimmed text (`''` if left blank), only Cancel/Escape/backdrop-click
  resolve `null`. The four broken call sites (`reportCard`'s "Remove
  content" and Dismiss, `sanctionFromReport`, `setPlanFromAdmin`) now check
  `note === null` and return before doing anything. The other `btPrompt`
  call sites (rename tag/category, new category, edit comment, change email)
  needed no change — they already used `!value`-style checks where treating
  an empty submit the same as a cancel was already the correct behavior for
  that field. Browser-verified: Cancel now leaves the report open / plan
  unchanged / sanction unapplied; OK with an empty note still proceeds.

### F. First-project setup tally (the claim trigger)

Decided 2026-09-12, replaces the plain "Save your project" pill. Audience
note: Brambletally's users skew ADHD/neurodivergent — the design choices
below (no percentage scoreboard, no countdown, checklist doubles as a guided
path rather than a nag) are chosen for that audience specifically, not
generic gamification.

- **Renders only** while `email IS NULL` (the anonymous, unclaimed account).
  Sits in `detail-topbar` next to Back/Print/Duplicate/Edit, where the pill
  was going to go.
- **Visual:** reuse the existing hand-drawn tally-mark component
  (`tallySvg`/`tallyLabel`, `app.js:36`) instead of a plain progress bar —
  five tracked items map onto exactly one group-of-five in that renderer, no
  new visual component needed.
- **Tracked items, 20% each, in this order** (payoff before bookkeeping):
  1. Title — auto-checked at creation, so the bar starts at 20%, never 0%.
  2. At least one step added.
  3. Category chosen.
  4. Description added.
  5. Deadline set.
- **Every unchecked item is clickable** and jumps to / focuses the
  corresponding control (description field, deadline picker, category
  select, the step quick-add row) — the checklist doubles as a guided path
  through the page rather than a scoreboard to hunt against.
- Clicking the tally itself at **any** percentage opens the claim-email flow
  (**C**) — it's motivation, not a lock.
- **On landing on a freshly-created project, auto-focus the step quick-add
  box** (same treatment Title gets on the create form, `app.js:4237`) —
  removes the "notice the empty box" step entirely for item 2.
- Zero backend change — `title`/`category`/`description`/`deadline`/step
  count are already loaded on the project page (`b.project`, `b.steps`).
- Copy stays restrained — short declarative sentences, no quest-log cosplay.
  The existing candle/quill/basket icon set and the tally marks themselves
  already carry the gentle-not-corporate tone; don't stack flavor text on
  top. A one-line toast on the first step added ("First mark made.") is
  about as far as this goes.
- **Named tradeoff, accepted:** someone who closes the tab without claiming
  is genuinely unreachable — no email captured, no re-engagement possible.
  This is the direct consequence of deferring the purge/funnel-log question
  (**E**) rather than a new gap; revisit together if it turns out to matter.

### Security note for B

The anonymous-creation endpoint in **B** needs the same Turnstile check
`request-link.js:19` already requires before any DB write on the login path.
As spec'd it's a wide-open unauthenticated endpoint that creates a real
`users` row (cascading to a project) on every hit — add the check so it
isn't a free-form spam vector. Turnstile is typically invisible to a real
visitor, so this doesn't reintroduce the friction **B** removes.

### Second gate found for B — the handle prompt

Browser-verified 2026-09-12. Separately from the TOS gate, `app.js:829` —
`if (state.me.needs_handle) return renderHandlePrompt()` — is a **client-side**
hard block (no server-side enforcement; `worker/index.js` has no equivalent
check, only `needs_handle` is exposed for the client to act on). A fresh
anonymous `users` row has `handle = NULL`, so even after the TOS fix in **B**,
an anonymous user would land straight into "Pick a handle" instead of their
project — a second wall we hadn't accounted for. Fix: the same render-gate
check needs to skip `renderHandlePrompt()` while `email IS NULL`, deferring
handle selection to the same moment as claiming the email (**C**) or accepting
an invite (**D**) — a handle is a social/sharing concept, so it belongs with
the rest of the identity-creation step, not before it.

### Open before building

- Whether the invite email template needs new copy vs. reusing the existing
  magic-link email with an "invited by X" line.
- Exact copy for the ToS checkbox on the "Start your first project" CTA.

## Planned: Shuffle — the Inbox rebrand (spec'd 2026-09-12)

Today's Inbox (`renderInbox`, `public/app.js:5544`) is just a capture box plus
a flat list of raw text (`inbox_items`, `schema.sql:357`). This turns it into
the place you go when you have a spare ten minutes and want to make some kind
of progress without deciding what to work on first — a Contactually
"bucket game" for everything outstanding across the app, not just raw
captures. Locked in discussion 2026-09-12:

- **Mechanic:** one card at a time, not a list. Draw a card, resolve it (or
  skip it, or mark it not applicable), the next one appears. No "browse
  everything" mode for v1.
- **Session bounds:** open-ended. No timer, no fixed count — you stop by
  navigating away. This is why there's no explicit "end session" control
  anywhere below.
- **Draw order:** weighted random, not a strict queue. Recently-touched
  projects with outstanding boxes are much likelier to come up, but nothing
  is ever fully buried — anything not shown in a while gets a rising boost
  until it surfaces.
- **Naming:** renaming the nav tab from "Inbox" to **Shuffle** (confidence:
  high — names the actual mechanic, avoids GTD jargon per the house copy
  rule, and there's no installed base to retrain). The capture textarea moves
  inside this same view rather than losing it. If "Shuffle" reads wrong once
  it's on screen, it's a one-line label change (`app.js:3446`) — nothing else
  depends on the string.

### A. What counts as a "box"

Seven kinds, each a single outstanding gap with one obvious resolving action.
Deliberately not "any empty field anywhere" — every kind below traces back to
something on your list (categorize / deadlines / missing info / add steps /
convert inbox items / next-step notes), plus one bonus kind (`looks_done`)
that fell out of the same query for free. Flag in review if `looks_done`
isn't wanted — it's the one kind you didn't ask for directly.

| kind | candidates | excluded |
|---|---|---|
| `inbox_unsorted` | every `inbox_items` row | — |
| `project_no_category` | `category IS NULL` | `status = 'Done'` |
| `project_no_deadline` | `deadline IS NULL` | `status NOT IN ('Active','Waiting For')` |
| `project_no_description` | `description IS NULL OR description = ''` | `status = 'Done'` |
| `project_no_steps` | leaf `step_count = 0` | `status != 'Active'` |
| `project_next_step_no_note` | the single earliest open leaf step (by `sort_order`) has `notes IS NULL OR notes = ''` | `status != 'Active'` |
| `project_looks_done` | `step_count > 0 AND step_done = step_count` | `status != 'Active'` |

All project-scoped kinds are further scoped to projects where the signed-in
user is `owner` or `editor` (same cut `openAssignStep` already uses,
`app.js:5622`) — a viewer can't act on any of these anyway.

### B. Schema — migration `0015_shuffle.sql`

One small table. Recency for the weighting comes from data that already
exists (`projects.updated_at`, kept current by every child write via
`touchStmt`, `worker/api/lib/projects.js:28`; `inbox_items.created_at`) — the
only new state is "when did the shuffle last show this box, and did the user
ask to skip or hide it."

```sql
CREATE TABLE shuffle_state (
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  box_key       TEXT NOT NULL,       -- '<kind>:<object_id>', e.g. 'project_no_category:abc123'
  last_shown_at TEXT,                -- NULL = never drawn
  snoozed_until TEXT,                -- set by "skip" — hidden until this passes
  dismissed_at  TEXT,                -- set by "not applicable" — hidden forever
  PRIMARY KEY (user_id, box_key)
);
CREATE INDEX idx_shuffle_state_user ON shuffle_state(user_id);
```

No FK on the object half of `box_key` — it's a loose reference by design (a
project or step can be deleted; the row just becomes inert and stops
matching any candidate query, same pattern as `reports.target_id`,
`schema.sql:158`).

### C. Draw endpoint — `GET /api/shuffle/next`

New file `worker/api/shuffle/next.js`, registered in `worker/routes.js`
next to the inbox routes (`routes.js:108`).

1. Run the seven candidate queries from **A**, each scoped to the signed-in
   user, `LEFT JOIN shuffle_state` to pull `last_shown_at`/`snoozed_until`/
   `dismissed_at`, filtering out `dismissed_at IS NOT NULL` and
   `snoozed_until > datetime('now')`.
2. If nothing comes back: `{ card: null }` — the empty state.
3. Otherwise score every candidate:
   - `recency = 1 / (1 + hoursSince(anchorTs) / 48)` — `anchorTs` is
     `projects.updated_at` for project-scoped kinds, `inbox_items.created_at`
     for `inbox_unsorted`. Recent ≈ 1, ~2-day half-life.
   - `staleness = last_shown_at IS NULL ? 3 : min(daysSince(last_shown_at) / 7, 3)`
     — never-shown items get the max boost immediately; anything else climbs
     back to that same ceiling over a week.
   - `weight = recency + staleness`.
4. Weighted-random pick (cumulative weights + one `Math.random()`).
5. Upsert `shuffle_state` for the picked `box_key`:
   `last_shown_at = datetime('now')` (insert if the row didn't exist).
6. Return `{ card: { box_key, kind, project: {...}, step: {...} | null,
   inbox_item: {...} | null } }` — just the fields the card UI needs (title,
   category, deadline, description, step title/notes, inbox text), not a
   full project bundle.

### D. Resolve, skip, dismiss

No new endpoints for *resolving* — every action in the table below already
exists:

| kind | resolving action | existing endpoint |
|---|---|---|
| `inbox_unsorted` | → Project | `openProjectForm` flow, `app.js:5589` |
| `inbox_unsorted` | → Step in… | `openAssignStep`, `app.js:5615` |
| `inbox_unsorted` | Delete | `API.deleteInbox`, `app.js:302` |
| `project_no_category` | pick a category chip | `PATCH /api/projects/:id` (`category`) |
| `project_no_deadline` | pick a date | `PATCH /api/projects/:id` (`deadline`) |
| `project_no_description` | write a line | `PATCH /api/projects/:id` (`description`) |
| `project_no_steps` | quick-add a step | `POST /api/projects/:id/steps` |
| `project_next_step_no_note` | write a note | `PATCH /api/projects/:id/steps/:stepId` (`notes`) |
| `project_looks_done` | Mark Done / add another step | `PATCH /api/projects/:id` (`status`) or the step endpoint above |

Two new tiny endpoints for the other two outcomes, both upserts against
`shuffle_state`, both `{ box_key }` in the body (not the URL — `box_key`
contains colons):

- `POST /api/shuffle/skip` → `snoozed_until = datetime('now', '+3 days')`.
- `POST /api/shuffle/dismiss` → `dismissed_at = datetime('now')`.

The client calls the matching resolve action (or skip/dismiss), then
immediately calls `/api/shuffle/next` again — that's the whole "shuffle"
feel, no separate "next" button needed on a successful resolve.

### E. Frontend — `renderInbox` becomes the Shuffle view

Same view key (`state.view === 'inbox'`, `app.js:3562`) so nothing else in
the router changes — only the nav label (`app.js:3446`,
`['inbox', 'Inbox']` → `['inbox', 'Shuffle']`) and the function body.

- Capture box stays at the top, unchanged (including the just-added
  multi-line paste-to-add-many behavior).
- Below it, one card at a time:
  - A one-line context header: the project title (linking to
    `openProject`) for project-scoped kinds, or "Captured" for
    `inbox_unsorted`.
  - Kind-specific prompt copy + inline control (category chips reused from
    the **A** create-form work above; a native date input; a textarea; the
    existing step quick-add row; two buttons for `looks_done`).
  - Action row: primary resolve button, **Skip**, **Not applicable**. Every
    action re-draws immediately on success.
  - Empty state (`card: null`): reuse `emptyVine()` — "Nothing outstanding
    right now."
- Auto-draw the first card on entering the view — no "shuffle" button to
  click first.

### F. What this replaces vs. leaves alone

- The Review tab (`renderReview`, `app.js:5957`) stays exactly as is — it's a
  passive weekly-review listing, not an interactive tool. Shuffle and Review
  answer different questions ("what needs attention right now" vs. "here's
  everything Active, read through it").
- Nothing about `project_next_step_no_note` touches `estimate_minutes` or
  `due_date` on steps — those stay out of scope for v1. Easy to add as an
  eighth kind later if it turns out to matter.

### Open before building

- Exact prompt copy per kind (e.g. what `project_looks_done` says) — short
  declarative sentences, no quest-log framing, per the usual house style.
- Whether `project_next_step_no_note` should also require the step be older
  than some minimum age before it counts (a step added five minutes ago
  probably doesn't need a note yet) — leaning towards **no age gate for v1**,
  since staleness weighting already means a brand-new empty-note step won't
  dominate the draw even though it's eligible.

## Planned: Data-integrity hardening pass (spec'd 2026-09-12)

Full-workflow review, not a response to a specific bug report. Three parallel
audits (project/task routes, board/social/admin routes, settings/cron/auth
edges) plus direct review of `account.js` and `callback.js`. Nothing below is
fixed yet — this section is the findings + proposed approach, ranked by
severity, for review before building.

The unifying root cause behind most of Critical/High: **`schema.sql`'s
`users(id)` references are inconsistent about `ON DELETE` behavior**, and the
two places that delete a `users` row (`account.js`'s hard delete,
`callback.js`'s anonymous-merge delete) were each written against only the
columns their author had in mind at the time, not the full column list. Every
column below has no `ON DELETE` clause (= SQLite `NO ACTION` = the delete
throws if a referencing row exists): `project_listings.created_by`,
`contributor_requests.decided_by`, `pending_invites.invited_by`,
`ownership_transfer_log.from_user_id`/`to_user_id`, `project_journal.user_id`,
`moderation_actions.admin_id`, `reports.resolved_by`.

### A. Critical

**A1. `DELETE /api/account` throws for most active users, not just edge
cases — fixed 2026-09-12 (decision: reassign-and-delete).**
(`worker/api/account.js:9-35`). It only refuses deletion if you currently
*own* a project with other collaborators — it never reassigns or checks the
seven no-cascade columns above. Confirmed reachable through the
ordinary board flow, not just admin actions: list a project → accept a
helper's request (`decided_by` = you) → transfer the project to them (you
drop to editor, `ownership_transfer_log.from_user_id` = you) → your account
is now undeletable, and D1 returns a raw constraint error (500) instead of
any explanation. Same trap from ever inviting a collaborator, journaling on a
project you don't own, or (if admin) taking any moderation action.
Confidence: high — reproduced the code path directly against schema.sql.

**Fixed:** new migration `0018_deleted_user_placeholder.sql` inserts a
permanent, never-logs-in `deleted-user` row (`DELETED_USER_ID` in
`constants.js`) with `disabled_at` pre-set, so every existing `disabled_at IS
NULL` filter already excludes it as an actor/owner. `account.js` now
reassigns all seven no-cascade columns onto it in the same batch as the
`DELETE`, mirroring `mergeAnonymousInto`. The existing "refuse if you own a
shared project" guard is unchanged — that one protects *other people's*
access to a still-live shared project, a different concern from the
FK-orphan columns, and reassigning `owner_id` itself was never part of this
fix. **Must run migration 0018 against prod before this deploys** — the
`UPDATE ... = 'deleted-user'` reassignments will themselves throw an FK
violation if that row doesn't exist yet.

**A2. Claiming an anonymous account can permanently fail — fixed 2026-09-12.**
(`worker/api/auth/callback.js:74-112`, `mergeAnonymousInto`). Reassigns
owner_id/collaborators/listings/decided_by/invited_by/transfer_log but misses
`project_journal.user_id` — any anonymous user who wrote a journal entry
before claiming hits the same FK crash on the merge's final `DELETE FROM
users`. Worse than A1: the magic-link token's `used_at` is stamped *before*
the merge runs (`callback.js:19-25`), so the failure burns the link — the
user is stuck requesting a new one, which fails the same way every time.
Separately (data loss, not a crash): the merge never reassigns
`inbox_items`, `categories`, `work_sessions`, `shuffle_state`,
`user_profiles`, `user_links`, `user_interests`, `follows`, `user_blocks`, or
`notifications` — these carry `ON DELETE CASCADE`, so they silently vanish
rather than merging into the target account, with no warning shown anywhere.
Confidence: high.

**Fixed (the crash):** `mergeAnonymousInto` now reassigns
`project_journal.user_id` too, so the claim path no longer throws. **Not
fixed (the data loss):** the cascade-deleted tables above are unchanged —
merging an anon account still silently drops its inbox/shuffle/profile/social
data. Left as a follow-up: reassigning all of them mirrors A1's "placeholder
row" question (should a claim ever silently discard user data, or should
every one of these get folded in too?), so it's cleaner to settle alongside
A1 than fix piecemeal.

### B. High — B2-B4 fixed 2026-09-12

**Fixed:** B2 (`requireBoardOk` gate added to listing PATCH, comment PATCH, and
request-decision PATCH), B3 (digest's `emailed_at` stamp now chunks ids in
groups of 100 instead of one unbounded `IN (...)`), B4 (feed's listing/comment
queries now also require the project's *current* owner to be non-disabled,
matching Board's rule, independent of the original actor's status). C1 (users
search excludes `disabled_at`) fixed alongside these — see section C.

**B1. Orphaned, unreachable `work_sessions` — fixed 2026-09-12.** Removing a
collaborator (`worker/api/projects/id/collaborators.js:140-152`, DELETE)
nulled their step assignments but never touched their planned focus sessions
on that project. Session mutation was gated on `row.user_id === g.user.id`
with no owner override (`worker/api/projects/id/sessions/sessionId.js:31,93`),
so once removed, nobody — not them (404 via `requireProject`), not the
owner — could ever edit or delete that session again; it kept showing to
every remaining collaborator indefinitely. Confidence: high.

**Fixed:** collaborator removal now also deletes their `work_sessions` on
that project (root cause — stops new orphans). `DELETE
/api/projects/:id/sessions/:sessionId` (not PATCH — editing stays
planner-only) additionally allows the project owner, as a safety net for any
row orphaned before this fix shipped.

**B2. Board-sanctioned users can still perform blocked writes — fixed
2026-09-12.** `requireBoardOk` (the `board_blocked_at` check) was missing on
three routes that are writes, not reads, contradicting the documented policy
at `worker/api/lib/board.js:38-47`: editing/reopening a listing
(`worker/api/board/listingId.js:122-167`, PATCH), editing an existing
comment (`worker/api/board/listingId/comments/commentId.js:18-37`, PATCH),
and accepting a pending contributor request — which inserts a real
`project_collaborators` row
(`worker/api/board/listingId/requests/requestId.js`). Confidence: high.
**Fixed:** the gate is now checked at the top of all three.

**B3. Weekly digest can loop forever for one user — fixed 2026-09-12.** The
digest's `UPDATE notifications SET emailed_at = ... WHERE id IN (...)` bound
one parameter per unemailed notification with no cap
(`worker/api/lib/digest.js:73-79`). Past roughly 100 in a week this exceeds
D1's per-statement bound-parameter limit, the `UPDATE` throws, `emailed_at`
never gets stamped, and the same notifications re-fetch and re-send in full
every following Sunday. Confidence: high — parameter-count math is direct,
D1's limit is documented. **Fixed:** the stamp now runs in chunks of 100 ids.

**B4. Feed and Board disagree on which listings are hidden after a
transfer — fixed 2026-09-12.** Board filtered by the *current* project
owner's `disabled_at` (`worker/api/board/index.js:33-34`); Feed filtered by
the *original listing creator's* `disabled_at`
(`worker/api/feed/index.js:45-51,66-77`). After an ownership transfer the two
could disagree in either direction. Confidence: medium-high. **Fixed:** both
feed sub-queries now also join the project's current owner and require
`o.disabled_at IS NULL`, on top of the existing actor check — hidden if
either the actor or the current owner is disabled, matching Board's guarantee
without dropping the "hide disabled actors' own content" behavior.

### C. Medium

- **C1. Disabled accounts stay searchable — fixed 2026-09-12.**
  `worker/api/users/search.js` was the one user-listing endpoint with no
  `disabled_at IS NULL` filter; added.
- **C2. `GET /api/settings/export` is incomplete — fixed 2026-09-12.** Was
  missing `work_sessions`, `user_links`, `user_interests`, `shuffle_state`,
  the user's own `notifications`, and several `users` columns (avatar_url,
  timezone, calendar_token, created_at, tos_accepted_at/version) — a real
  completeness gap for a feature whose whole point is "everything tied to my
  account." All now included.
- **C3. Weekly review overcounts — fixed 2026-09-12.**
  `worker/api/review.js:36-41` counted "steps completed this week" over all
  `project_steps`, without the `NOT_CONTAINER` filter every sibling query
  uses — a fully-checked-off container (a step split into sub-steps via
  "bash") added a derived double-count on top of its own children. Filter
  added.
- **C4. No idempotency guard on the cron jobs — assessed, not changed.**
  `digest.js` and `reminders.js` both read-then-later-write with no
  transaction or unique constraint backing it, so two overlapping runs could
  in principle both pass the same "not yet sent" check. In practice the risk
  is lower than the original framing assumed: `worker/index.js`'s
  `scheduled()` wraps each job in `.catch(e => console.error(...))` before
  returning, so a thrown error never propagates out of the handler —
  Cloudflare sees a clean return and won't auto-retry on failure. The
  remaining exposure is a manual duplicate trigger (dashboard "Trigger now"
  overlapping the real scheduled run), which is an operational scenario, not
  a code path. A real fix (claim-before-send, or a unique index on
  `notifications(user_id, type, subject_id)`) would trade away the
  deliberate "never stamp `emailed_at` unless a send actually succeeded"
  guarantee that protects against losing a user's week when Resend isn't
  configured — not worth that tradeoff for a risk this narrow. Revisit if a
  real double-send is ever reported.
- **C5. Notification mode-switch gap — assessed, not changed.** A
  notification queued while `notif_prefs.mode = 'weekly'` never gets emailed
  if the user switches mode before the next Sunday — it stops matching the
  digest's mode filter but is never stamped `emailed_at`. Less serious than
  first framed, though: `digest.js`'s own SELECT windows on
  `created_at > datetime('now', '-8 days')`, so the row simply ages out of
  every future run's candidate set within 8 days — nothing accumulates or
  loops. The only real gap is switching `weekly` → `immediate` mid-week
  doesn't retroactively email that week's backlog. Not fixing: retroactively
  firing emails on a settings change has its own surprise-factor downside (a
  batch of days-old notifications landing the moment someone changes a
  preference).
- **C6. Email-change race — fixed 2026-09-12.** `settings/email.js` and
  `auth/email-change.js` each pre-check the new address for a clash, but
  neither check was atomic with the final `UPDATE users SET email = ?`. Two
  users racing for the same address could both pass their own pre-check; the
  loser hit the partial unique index and got a raw 500 instead of the
  intended "email taken" response. **Fixed:** the confirm-side `UPDATE` is
  now wrapped in try/catch and redirects to `?email=taken` on a constraint
  violation, same as the pre-check's clash path.

### D. Low — all fixed 2026-09-12

- **D1.** `worker/api/projects/id/duplicate.js:60-109` batched every
  step/supply/link insert unbounded (previously deferred in the personal-
  utility-batch review) — real risk only for very large projects (hundreds
  of steps). **Fixed:** inserts now run as sequential chunks of 50 statements
  (`BATCH_CHUNK`) instead of one `db.batch()`; a failure partway cascades
  away whatever had committed under the new project id rather than leaving a
  half-duplicated project, since chunking trades away the single-transaction
  atomicity the old unbounded call had.
- **D2.** `worker/api/search.js:38-50` had no `NOT_CONTAINER` filter, so a
  step converted into a container via "bash" still showed its old, now-
  meaningless `estimate_minutes` in search results. **Fixed:** the search
  query now nulls `estimate_minutes` for container steps (same predicate
  every sibling query already uses), rather than dropping them from results
  entirely — finding a container by title/notes is still useful, it just no
  longer shows a stale number.
- **D3.** `digest.js`/`reminders.js` queries had no `LIMIT` — fine at current
  scale, a future scale risk as the user base grows. **Fixed:** both
  candidate queries now cap at 10,000 rows with a loud `console.error` if the
  cap is ever hit, so a future overrun fails visibly (some users silently
  missing one run) rather than the whole cron job failing for everyone via
  a D1 response-size error. Not full pagination — not worth that complexity
  at a "years away, if ever" scale — but bounded and observable.

## Planned: Data-integrity hardening pass 2 — abuse surfaces + frontend (spec'd 2026-09-13)

Follow-up to the pass above, once it was live on prod. That pass covered
`worker/api/**` almost entirely; this one covers what it didn't: the
frontend (`public/app.js`, ~6,930 lines; `public/app.css`) got no review at
all, and a few backend surfaces (rate-limiting/bot-protection coverage,
top-level sessions/tasks/calendar routes, deeper admin routes) only a light
pass. Two parallel audits plus one direct check (Supporter-tier gate
enforcement) below. Nothing here is fixed yet.

### A. High — real abuse/cost vectors, no product-decision ambiguity

**A1. Contributor-request creation has no bot-check at all — fixed
2026-09-13**, contradicting
the app's own documented design. `worker/api/lib/board.js:12-14`'s comment
says a Turnstile challenge should guard a new account's first few board
writes — explicitly "**requests + reports**" — and `reports/index.js:64-73`
correctly implements that (checks `boardActionCount < TURNSTILE_UNTIL_ACTIONS`,
then verifies the token). `board/listingId/requests.js` (POST, "ask to
contribute") never imports or calls `verifyTurnstile`, and never even reads
`boardActionCount`. Scenario: a scripted brand-new account can spam
contributor requests at listing owners up to `REQUEST_DAILY_CAP` (10/day)
indefinitely, with no CAPTCHA ever required — the soft daily counter is the
only defense that exists, not the documented challenge. Confidence: high.

**Fixed:** `board/listingId/requests.js` now runs the identical
`boardActionCount < TURNSTILE_UNTIL_ACTIONS` → `verifyTurnstile` gate as
`reports.js`. Frontend: `openRequestModal`/`API.requestContribute` now mount
the same `mountTurnstileWidget` helper the report modal uses, conditional on
`state.me.board_new`, matching that modal's pattern exactly. Verified the
new code path runs cleanly end-to-end against a seeded local D1 (fresh
0-action account, request succeeds through the new gate) — local dev's
`TURNSTILE_SECRET_KEY` is intentionally blank (same as every Turnstile route
here until the secret is provisioned), so an actual rejection can't be
observed locally; this mirrors `reports.js`'s already-proven-in-production
implementation exactly, which is the strongest available confidence short
of a live secret.

**A2. Unlimited invite-by-email — real emails, real account creation, no
cap — fixed 2026-09-13.** `worker/api/projects/id/collaborators.js:43-88` (POST, invite by
email) has no rate limit and no Turnstile. Any signed-in user who owns any
project (trivial to create) can invite arbitrary addresses; each new one
gets a real `users` row, a `magic_links` row, and an actual "you've been
invited" email (`sendMagicLink`, line 83) — with no consent from the
address owner and no throttle anywhere in the path, unlike every other
mail-sending or account-creating endpoint in the app. Scenario: loop over a
list of email addresses, inviting each to a throwaway project — unlimited
volume, at Brambletally's sending cost and Resend deliverability
reputation, and each target now has an unsolicited account. Confidence:
high — this is the worst finding in this pass, both in blast radius (any
signed-in user, zero extra privilege needed) and cost (real external email
sends).

**Fixed:** a 5/day rolling-24h cap (`INVITE_DAILY_CAP`,
`worker/api/projects/id/collaborators.js`), same count-query pattern as
`REQUEST_DAILY_CAP`/`REPORT_DAILY_CAP`, scoped to the calling user across
every project they own — counts `pending_invites` rows, which only get
created on the new-account branch, so it can't be dodged by spreading
invites across many projects. Deliberately does NOT gate re-inviting an
existing account (no email sent on that path, nothing to cap).
Verified against a seeded local D1: invites 1-5 to distinct new addresses
succeeded, invite 6 returned `429`, and re-inviting an already-created
address (existing account, no new email) still succeeded while over the
cap.

**A3. Reopening a listing bypasses the Supporter listing cap — fixed
2026-09-13.** `activeListingCap` (`lib/board.js:31`) — free: 1 open listing,
Supporter: 3 — is enforced only at listing *creation* (`board/index.js:94-108`).
`board/listingId.js` PATCH (`status` transition) never re-checks it.
Scenario: free user opens listing A, closes it, opens listing B (cap check
passes — A is closed, count is 0), then `PATCH A {status:'open'}` — no cap
check on this call — now has 2 open listings against a cap of 1, repeatable
without limit for any number of listings they own. This is the concrete
answer to a question this pass set out to check: a downgraded/free user
isn't just passively grandfathered over the cap, they can actively keep
re-opening past it forever. Confidence: high.

**Fixed:** the PATCH handler now re-checks `activeListingCap` whenever
`status` transitions *into* `'open'` from something else, scoped by the
project's **current** `owner_id` (not `l.created_by` — the two can diverge
after a transfer, and it's the current owner whose cap this counts against).
Verified against a seeded local D1: reopening listing A while listing B was
already open correctly returned `403` for a free account, and correctly
succeeded for the same scenario once the account was a Supporter (cap 3).

### B. Medium

**B1. Email-change and account-claim requests can mail-bomb an address the
caller doesn't control — fixed 2026-09-13.** `settings/email.js` and
`auth/claim.js` each retire the caller's own prior pending request before
inserting a new one (one live token *per calling user*), but nothing stops
the same user from immediately calling again to re-mail the same target
address — no per-user daily cap analogous to
`REQUEST_DAILY_CAP`/`REPORT_DAILY_CAP` exists on either path. Scenario:
repeatedly POST `{email: "victim@example.com"}` to either endpoint in a
loop; each call sends a fresh real confirm/magic-link email to an address
the caller doesn't own. Confidence: high.

**Fixed:** a 5/day rolling-24h cap on each route (`EMAIL_CHANGE_DAILY_CAP`
in `settings/email.js`, `CLAIM_DAILY_CAP` in `auth/claim.js`), same
count-query pattern as `REQUEST_DAILY_CAP`. Verified against a seeded local
D1: 5 requests succeeded on each route, the 6th returned `429`.

**B2. "Load more" can duplicate results on a fast double-click — fixed
2026-09-13**, in all four places that paginate this way: board listings,
board/feed activity, interest discovery, and the followers/following list
(`app.js` — board listings ~2806-2836, activity ~2879-2910, interests
~2029-2069, followers/following ~2088-2138). Each `loadMore(btn)` only
removed/disabled the button *after* the request resolved, and only advanced
`cursor` at that same point — so a double-click (or fast double-tap) fired
two requests with the identical stale cursor, and both responses appended
their page to the list. Scenario: double-click "Load more" on the Board
tab — the next batch of listings renders twice. Confidence: high.

**Fixed:** all four now disable the button synchronously on click, before
the `await`, and re-enable it on failure (previously a failed "load more"
silently did nothing and left the button clickable, which was fine; now it
correctly un-disables so a transient failure can be retried, rather than
trading the double-click bug for a permanently-stuck button). Verified
against a real authenticated browser session (Board Listings and Activity
tabs both load and paginate correctly, no console errors).

**B3. The unread-notification badge clears even when marking-read
fails — fixed 2026-09-13.** `app.js:3477-3486`'s own comment says "leave the
badge; it'll clear next load" inside the `catch` — but `state.me.unread_count
= 0` and the bell-dot removal ran unconditionally after the try/catch, not
only on success. Scenario: open the notification panel on a flaky
connection — the mark-read request throws and is swallowed, but the badge
disappears anyway even though the server still has those notifications
marked unread; the mismatch surfaces confusingly later (another device or a
reload still showing the old count). Confidence: high — the code
contradicted its own comment.

**Fixed:** the badge-clear and bell-dot removal moved inside the `try`,
right after the confirmed-successful `API.markNotificationsRead()` call —
they now only run when the server actually confirmed. Verified against a
real authenticated browser session: opening the notification panel with two
seeded unread notifications correctly displayed both and cleared the badge
after a successful mark-read call.

### C. Low

**C1. Board comments have zero rate limiting — fixed 2026-09-13** — not
even the soft daily counter contributor-requests has. `board/listingId/comments.js`
(POST) has no Turnstile (likely fine — `lib/board.js`'s comment only names
"requests + reports," not comments) but also no daily cap of any kind.
Scenario: one account posts comments in a tight loop with no server-side
limit, flooding a listing's thread and generating unlimited `notify()`
calls to the owner/parent-comment author. Confidence: medium.

**Fixed:** a 50/day rolling-24h cap (`COMMENT_DAILY_CAP`, `lib/board.js`) —
set higher than `REQUEST_DAILY_CAP`/`REPORT_DAILY_CAP` since normal
commenting is far more frequent than filing requests/reports; this is a
flood backstop, not an everyday limit. Verified against a seeded local D1:
comment #50 (today) succeeded, #51 returned `429`.

**C2. The ICS calendar feed's line-folding measures the wrong unit — fixed
2026-09-13.** `worker/api/lib/ics.js`'s `fold()` measured JS string
`.length` (UTF-16 code units) against the RFC 5545 75-*octet* limit the
file's own comment promised. A `note`/`project_title` with multi-byte
characters (emoji, accented letters, CJK) could produce a folded line whose
byte length exceeded 75 even though its character count didn't — most
calendar clients tolerate it, so this was cosmetic, but a real spec
violation on a feed shared across every calendar app a user subscribes
with. Confidence: medium.

**Fixed:** `fold()` now encodes to UTF-8 bytes first and folds on byte
count, backing the cut point off any continuation byte per RFC 5545 §3.1's
"never split a multi-octet character" rule. Verified with a standalone
script: a note of 40 emoji (160 UTF-8 bytes, ~120 JS-length units) and a
note of mixed accented/CJK text both produced calendars where every
physical line is ≤75 octets, and reconstructing each field from its folded
continuation lines round-trips byte-for-byte identical to the original —
no line-splitting corruption at a fold boundary.

**C3. Shuffle's Skip/"Not applicable"/resolve buttons have no busy-state
guard — fixed 2026-09-13**, unlike everything in B2 this is a narrower
window (needs a fast double-click) but the same missing-disable pattern: a
rapid double-click fired two skip/dismiss calls plus two redraws
concurrently, and because both responses render into the same slot, the two
in-flight draws could resolve out of order — the first (now-stale) card
could overwrite the second, correct one. Confidence: medium.

**Fixed:** `shuffleFooter`'s Skip and "Not applicable" buttons now share a
closure-scoped busy flag — whichever fires first blocks the other until it
resolves (re-opened on failure so a transient error can be retried); the
inbox-capture Delete button got the same guard. Scoped to exactly the
buttons the finding named, not every kind-specific control in
`renderShuffleCard` (category chips, date pickers, etc.) — those go through
separate, slower interaction patterns (a select/date input, not a bare
button) and weren't part of this finding. Verified against a real
authenticated browser session: an inbox-capture card rendered with
→Project/→Step in…/Delete/Skip, and clicking Skip correctly snoozed the
item and redrew to the empty state with no console errors.

### Confirmed clean — no action needed

- **Frontend XSS sweep**: every user-generated field traced through its
  render site; all go through `esc()`/the `h()` template helper or
  `.textContent` assignment. `innerHTML` appears only 4 times in the whole
  file, all with trusted/static content. No stored-XSS vector found.
- `worker/api/sessions.js`/`sessions/id.js` (read-only, correctly scoped to
  the caller), `worker/api/tasks.js` (correctly excludes removed
  collaborators' tasks and container steps), `worker/api/calendar/token.js`
  (correctly scoped, no stale-token fallback), `admin/users/handle/sanction.js`
  (can't lock out all admins), `admin/interests/merge.js` (batch ordering
  correct) — all reviewed fresh, nothing found.
- **Supporter-tier gates** described in `docs/plan.md`/`docs/social-plan.md`
  (themes, project emblems, accent colour, avatar upload, photo count) —
  checked directly (not by either agent): none of these are bypassable
  because none of them are *built*. No schema columns, no write endpoints —
  `avatar_url` exists on `users` but is never written by any route. This
  isn't a hardening gap, just unbuilt scope; noted so it isn't mistaken for
  a client-side-only-enforced gate (which would have been a real bug).

### Open before building

- **Rate-limit values aren't picked yet.** A2/B1/C1 each need a cap.
  Proposing to mirror the existing `REQUEST_DAILY_CAP`/`REPORT_DAILY_CAP`
  pattern (rolling-24h count query, no new table) at first for consistency,
  but A2 and B1 both send real email to addresses the caller doesn't
  necessarily control — arguably deserve a tighter cap (e.g. 5/day) than
  the existing 10/day used for in-app-only actions like contributor
  requests. Your call on the exact numbers.
- **A1 needs frontend wiring, not just a backend check.** The "ask to
  contribute" form has no Turnstile widget today; making A1's fix real means
  reusing whatever pattern the report-filing UI already uses to render one
  conditionally when `board_new` is true. Backend-only would just move the
  gap from "no check" to "check exists but the client never sends a token,"
  so this one's scope is bigger than the others.

### Suggested build order

A2 (worst cost/blast-radius) → A1 (needs the frontend piece, so pairs with
the above) → A3 → B1 → C1 → B2/B3/C3 (all frontend, one pass) → C2.

### Open before building

- **A1's fix shape is a real product decision, not just an implementation
  detail.** Three options, roughly in order of how much they change user-
  facing behavior:
  1. **Reassign-and-delete** — mirror what `mergeAnonymousInto` already does:
     on account deletion, reassign every no-cascade column to some
     placeholder (needs a permanent "deleted user" system row, since these
     columns are all `NOT NULL`), then delete. Keeps deletion truly
     permanent; adds one synthetic row to the schema.
  2. **Refuse-with-full-check** — extend `account.js`'s existing "refuse if
     shared" pattern to check all seven relationships, and tell the user
     exactly what to resolve first (transfer/withdraw/etc.) before they can
     delete. No schema change, but deletion becomes multi-step for anyone
     with board/collaboration history — which, per B-audit, is most active
     users.
  3. **Soft delete / anonymize in place** — stop hard-deleting the row;
     instead null out PII (email, name, avatar, handle) and keep the id, so
     every FK stays valid with zero reassignment logic. Changes the meaning
     of "delete my account" (the row persists) — worth confirming this is
     acceptable before building it, especially given `account.js`'s existing
     comment implies users expect a real delete.
  Leaning toward **option 1** for consistency with how the anonymous-merge
  path already works and because it keeps "delete" meaning delete, but this
  is the one item in this whole spec that's a judgment call rather than a
  clear bug fix — flag before building.
- **Whether to fix A2's missing `project_journal` reassignment as part of
  A1's work** (same placeholder-row mechanism would cover both) or
  separately/sooner, since A2 is reachable today by anyone using Shuffle's
  guided-onboarding claim flow.
- **Build order**, pending the above: A2 alone (journal reassignment, no
  product decision needed) → A1 (once the approach is picked) → B1-B4 → C1-C6
  → D1-D3 as time allows. B2-B4 and C1 are independent one-file permission-
  filter fixes with no schema impact and could land first/fastest if a quick
  win is wanted before the account-deletion decision is settled.

## Planned: Shuffle — mainline editing on the card (spec'd 2026-09-13)

**Built and browser-verified against `wrangler dev` 2026-09-13** (not yet
committed). All three pieces confirmed working: "Edit …" opens the full
project form on the card and resolves-in-place on save (no navigation away
from Shuffle); the collapsed "Steps" section lazy-loads and supports
check-off/rename/add without resolving the card; "→ New project" spins the
step out into a real standalone project and removes it from the source.
Along the way, found and fixed an unrelated pre-existing bug blocking *every*
brand-new sign-up since the 2026-09-12 anonymous-users migration: the new-user
`INSERT ... ON CONFLICT(email)` in `worker/api/auth/callback.js` didn't
account for `idx_users_email` becoming a partial index, so SQLite refused the
upsert with "ON CONFLICT clause does not match any PRIMARY KEY or UNIQUE
constraint" — a 500 on every first-time magic-link callback. Fixed by adding
the matching `WHERE email IS NOT NULL` to the conflict target. Confirmed live
locally (sign-in with a brand-new address now succeeds); **not yet deployed
to prod** — flagging since this affects every real new-user signup until it
ships.

Today each Shuffle card (`renderShuffleCard`, `app.js:5885`) only exposes the
one field its box kind is about — pick a category, pick a deadline, write a
note. The point of Shuffle is to make working on a random project fun *and*
productive, so a card shouldn't be a dead end if what you actually want to
fix is a different field, or the project's steps. Locked in discussion
2026-09-13:

- **Promote a step to its own project.** `project_next_step_no_note` is the
  only card kind that carries a `step` — add a "→ New project" action next to
  its Save button. Confirm, then it becomes a real standalone project (title
  = step title, description = the step's notes if any) and the step is gone
  from the source project. Resolves the card like any other action.
- **"Edit …" opens the full project form on top of the card**, for every
  project-scoped kind (not `inbox_unsorted`, which has no project). This is
  the existing `openProjectForm` sheet unchanged — title, category, status,
  deadline, description, pickup note, archive/delete — just reachable from
  Shuffle without leaving it. On save, redraws the next card (same "every
  action redraws" convention as the rest of Shuffle) instead of navigating to
  the project page.
- **A collapsed "Steps" section**, default closed, on every project-scoped
  card. Expanding it lazy-loads the full step list (`stepBlock`/`stepRow`,
  the same rows the project detail page uses) — check off, rename inline,
  add, "⋯" for notes/estimate/delete. Its own re-render is local to the
  section (refetches the project bundle, redraws just this block) — it does
  **not** resolve the card, so poking at unrelated steps doesn't cost you the
  box you're mid-editing.

### A. Backend

- `worker/api/lib/shuffle.js`: add `pc.role` to `PROJECT_COLS` and
  `shapeProject` — the full-editor sheet's archive/delete buttons key off
  `existing.role === 'owner'`, and today's `shapeProject` doesn't carry it.
- New `POST /api/shuffle/promote-step` (`worker/api/shuffle/promote-step.js`,
  registered in `routes.js` next to the other shuffle routes) — body
  `{ project_id, step_id }`. `requireProject(..., 'editor')`, load the step,
  reject if it's not top-level or has sub-steps (defensive; the box query
  already only ever surfaces a leaf). One `db.batch`: insert the new project
  + its owner collaborator row, delete the source step, `touchStmt` the
  source project. Returns `{ project }`. No new `shuffle_state` bookkeeping
  needed — the step is gone, so the candidate query stops matching on its
  own (same "inert row" pattern the table already relies on).

### B. Frontend (`public/app.js`)

- `API.shufflePromoteStep(projectId, stepId)` — thin wrapper, same shape as
  the other shuffle client methods.
- `openProjectForm`: the existing-project save path currently always ends
  with `close(); openProject(existing.id);`. Add an `opts.onSaved` escape
  hatch — when passed, call it instead of navigating to the project page;
  every other call site is unaffected (no caller passes it today).
- `renderShuffleCard`: for any kind with a `project`, add an "Edit …" button
  in the card head that calls `openProjectForm(project, { onSaved: onResolved })`,
  and a `shuffleStepsSection(project, canEdit)` block before the footer — a
  `.done-toggle`-style disclosure (reusing that class, no new chevron
  styling needed) that lazy-fetches `API.getProject(project.id)` on first
  expand and renders with the existing `stepTree`/`stepBlock`/`quickAddRow`
  helpers, `canEdit = project.role === 'owner' || project.role === 'editor'`.
  Its `rerender` callback just re-runs the same fetch-and-redraw, scoped to
  the section.
- `project_next_step_no_note`'s footer gains the promote button (a
  `btConfirm` guard, then `API.shufflePromoteStep`, then `onResolved()` like
  every other resolve action).

### Open before building

- Confirm the "→ New project" copy/confirm wording — leaning toward
  `Make "<step title>" its own project?` since it names exactly what happens.
- Whether the promoted project should inherit the source project's
  `category` — leaning **no** (leave it uncategorized, same as any other
  freshly created project) since there's no signal the two should be grouped
  together; easy to flip if it turns out people expect it.

### C. Landing page — Shuffle gets its own section (built 2026-09-13)

Shuffle is the highest-value feature and was getting lost as one of four
tiles under "How it works." `src/pages/index.astro`:

- New `#shuffle` section, its own spotlight panel (`.shuffle-spotlight` /
  `.shuffle-grid`, mirrors the `#who` two-column pattern) between `#who` and
  `#how`. Copy + a `.cta` linking to `/app`, live demo alongside it.
  `#how`'s `.features` grid drops the Shuffle tile (Steps/Focus/Review only,
  regridded to 3 columns).
- **Conversion routing:** the demo's "Edit…" and its primary action
  (Save / Add step / → Project) now navigate to `/app` instead of just
  cycling the canned card — the moment someone tries to act on a card for
  real is the moment they need an account. Skip and the step checkboxes stay
  local (still just "show me another example").
- Demo card itself de-centered to match the real card's left-aligned layout
  now that it sits in a grid column instead of standing alone.

## Planned: Nav reorder + Next absorbs Quick tasks/My tasks (spec'd 2026-09-13)

Discussion 2026-09-13 mapped every "flat list of open steps across projects"
surface in the app and found three doing the same underlying job in two
different places: Home's `Quick tasks` and `My tasks` modes (`state.homeMode`,
`app.js:4423`) and the top-nav **Next** view — sliced by estimate, by
assignee, and by due date respectively, but all pulling from the same
open-leaf-step pool. Decision: consolidate all three into Next; Home's mode
toggle goes away, back to pure browse. Shuffle is a genuinely different job
(one-at-a-time gap-filling/triage, not task execution — see
`worker/api/lib/shuffle.js`) and was already correctly separate. Review is
spared for now — it does a different job already (full project listing, not a
task list) but has its own follow-on noted below.

**Nav order (built 2026-09-13):** `header()` (`app.js:4174`) reordered to
Projects · Shuffle · Next · Review · Board — Shuffle moved up next to Projects
since it's the highest-traffic entry point (see "Shuffle gets its own landing
section" above), ahead of the two step-list views.

### Next absorbs Quick tasks + My tasks

- **New `state.nextMode`**, default `'due'` (also `'quick'` | `'mine'`). A
  small mode-switcher row (reuse the `.bt-home-mode` button styling, renamed
  generically e.g. `.bt-next-mode`) at the top of `renderNext` (`app.js:6877`):
  **Due · Quick · Mine**.
- `'due'` — today's existing bucketed body (Overdue/Today/This week/Later,
  the nudge line, the "Surprise me" button) — unchanged.
- `'quick'` — move `renderQuickTasks` (`app.js:4534`) into this section as-is:
  cap chips (≤15/30/60m/All), estimate-then-due-date sort, flat list. It
  currently takes `review` as a param from its Home caller's single shared
  fetch; since it moves under `renderNext`, it fetches its own
  `API.review()` the same way `renderNext`'s `'due'` branch already does.
- `'mine'` — move `renderMyTasks` (`app.js:4613`) in the same way; no
  data-fetch change needed, it already calls `API.getTasks()` itself.
- `state.quickCap` (`app.js:903`) stays as-is, just now read/written from
  Next instead of Home.
- **Home** (`renderHome`, `app.js:4423`): delete the `.bt-home-modes` button
  row and the two `if (state.homeMode === …)` early-returns
  (`app.js:4436-4445`). `state.homeMode` itself goes too — nothing else reads
  it once this lands. Home becomes what it was before Quick tasks/My tasks
  existed: the hero, due-band, and next-focus banner, then the card grid with
  its status/category filters.
- The nudge line and "Surprise me" button stay `'due'`-only — they're
  specific to that view's voice, not to Quick or Mine.

### Not in this pass

Review keeps its current shape (full Active/Waiting-For listing, grouped by
project, all open steps inline). The staleness / no-open-steps / "looks done
but not marked" audit signals discussed the same day are a natural fit for
making Review earn its nav slot — and notably,
`worker/api/lib/shuffle.js`'s `fetchCandidates` already computes most of
them (`project_no_steps`, `project_looks_done`, hours/days since touched) for
Shuffle's one-at-a-time draw. Reusing that vocabulary as inline badges on
Review's project cards, instead of inventing a parallel staleness query, is
the likely shape of that work — but it's a separate spec, not committed here.

### Build order

1. Add `state.nextMode` (replaces `state.homeMode` for these two views) and
   the mode-switcher row in `renderNext`.
2. Move `renderQuickTasks` and `renderMyTasks` under Next's `'quick'`/`'mine'`
   branches; drop their Home call sites.
3. Strip Home back down: remove the mode row and the two early-returns in
   `renderHome`.
4. Verify: Quick tasks' cap-chip state and My tasks' assignee list both still
   work identically, just reached via Next's switcher instead of Home's.
