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
  initials avatar, active board-listing count, profile badge — never the core
  project/step/collaboration features. (Email frequency was on this list;
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
  branch on `event.cron`: `"0 15 * * 0"` → `runWeeklyDigest`; `"0 12 * * *"` →
  `runDueReminders`. Both under `ctx.waitUntil` with a `.catch`.
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
| **Journal entry edit** | Tap an entry → `inlineEdit` multiline. |
| **Supply `acquired`** | Already a checkbox — confirm it's a direct toggle, not a form open. |

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
