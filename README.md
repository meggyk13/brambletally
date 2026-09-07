# Brambletally

A project tracker for craft, research, and event work — projects with steps,
sub-steps, supplies, deadlines, a journal, a GTD-style inbox and weekly review,
and shared/collaborative projects. Magic-link sign-in, no passwords.

Extracted from Rayhana's Repositorium (September 2026) into its own site at
**brambletally.com**.

## Stack

- **Frontend:** Astro, static output. One client-rendered page
  (`src/pages/index.astro`) plus `public/app.{js,css}`.
- **Backend:** a single Cloudflare Worker with static assets (`worker/`). The
  edge serves `dist/` first; the Worker only handles `/api/*`. See
  [worker/README.md](worker/README.md).
- **Database:** Cloudflare D1 (SQLite). Schema in [schema.sql](schema.sql).
- **Auth:** magic-link email via Resend. Bot check via Cloudflare Turnstile.

## First-time setup

```bash
npm install

# 1. Create the database, then paste its id into wrangler.jsonc
npx wrangler d1 create brambletally

# 2. Load the schema (fresh DB — do NOT also run migrations/, they are folded in)
npx wrangler d1 execute brambletally --remote --file=./schema.sql

# 3. Secrets (or set them in the Cloudflare dashboard)
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put MAIL_FROM        # e.g. "Brambletally <login@brambletally.com>"
```

Then connect the repo to a Cloudflare **Worker** (Workers Builds): build
command `npm run build`, and bind `DB` (D1) + `ASSETS` in the dashboard. Add
`brambletally.com` as a custom domain.

Config that carries the domain: `worker/api/lib/constants.js`
(`CANONICAL_ORIGIN`, `FROM_EMAIL`) and the Turnstile **site** key in
`public/app.js`.

## Local dev

```bash
npm run dev        # Astro only, API calls 404 (no Worker/D1)
# or, full stack:
npm run build && npx wrangler dev
```

For `wrangler dev`, copy `worker/.dev.vars.example` to `.dev.vars`. With no
secrets set, magic links are logged to the console and the bot check is skipped.
Seed a local DB for the "Next" view with `migrations/seed_dev_next.sql`.

## Docs

- [docs/plan.md](docs/plan.md) — original build plan (port from "noodlr", GTD
  structure, collaboration).
- [docs/social-plan.md](docs/social-plan.md) — scoping for profiles, settings,
  a public "help wanted" board, and following. Not built yet.

`migrations/` holds incremental schema changes for an already-deployed DB.
`schema.sql` is the full current schema for a fresh install and already
includes every migration — run one or the other, not both.
