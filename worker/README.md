# Brambletally API (Cloudflare Worker)

Backend for Brambletally. The site deploys as a **Worker with static assets**
(`wrangler.jsonc` → `main: worker/index.js`, `assets.directory: ./dist`).
Static files in `dist/` (built from `src/` + `public/` by `astro build`) are
served by the edge before the Worker runs, so `worker/index.js` only handles
`/api/*` and 404s everything else.

- `worker/index.js` — entry + tiny path router + per-request session load.
- `worker/routes.js` — the `[pattern, module]` table. `:name` segments become
  `context.params.name`.
- `worker/api/**` — one module per endpoint, each exporting `onRequestGet` /
  `onRequestPost` / `onRequestPatch` / `onRequestDelete`. They take a
  Pages-Functions-shaped `context` (`{ request, env, params, data, waitUntil }`)
  that the router builds.
- `worker/api/session.js` — `loadSession(context)`; sets `context.data.user`
  from the `brambletally_session` cookie, returns a `slideCookie` to append
  when the 30-day window is refreshed.

## Bindings

Set in `wrangler.jsonc` (picked up by Git-connected Workers Builds):

| Name | Type | Notes |
| --- | --- | --- |
| `DB` | D1 database | `brambletally` — set `database_id` after `wrangler d1 create` |
| `ASSETS` | assets | serves `dist/` |

Secrets — set with `wrangler secret put NAME` or in the dashboard (Worker →
Settings → Variables and Secrets):

| Name | Notes |
| --- | --- |
| `RESEND_API_KEY` | magic-link email. Unset → link is logged, not sent |
| `TURNSTILE_SECRET_KEY` | bot check. Unset → check is skipped |
| `MAIL_FROM` | optional; overrides the default `From:` address |
| `APP_ORIGIN` | optional; overrides the origin used to build the emailed link |

The Turnstile **site** key is public and lives in the frontend (`public/app.js`).

## Local dev

```
npm run build                       # produce dist/
npx wrangler dev                    # serves the Worker + dist/ assets
# needs .dev.vars for secrets (copy worker/.dev.vars.example). D1 --local is a
# separate sqlite file:
npx wrangler d1 execute brambletally --local --file=./schema.sql
```

## Routes

- `auth/request-link` (POST) · `auth/callback` (GET) · `auth/logout` (POST) ·
  `auth/me` (GET)
- `projects` (GET, POST) · `projects/:id` (GET bundle, PATCH, DELETE) ·
  `projects/:id/steps` · `.../steps/:stepId` · `.../steps/:stepId/bash` (POST) ·
  `.../supplies` · `.../supplies/:supplyId` · `.../journal` (viewers read,
  editors post) · `.../collaborators` (owner-managed) · `.../transfer` (POST)
- `review` (GET) · `search?q=` · `categories` (GET, POST) ·
  `categories/:categoryId` (PATCH, DELETE) · `inbox` (GET, POST) ·
  `inbox/:itemId` (PATCH, DELETE) · `users/search?q=`

Role ranks: `viewer < editor < owner`. No role on a project → 404, not 403, so
existence doesn't leak.
