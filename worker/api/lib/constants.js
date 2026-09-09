// Shared config for Brambletally's API.

export const SESSION_COOKIE = 'brambletally_session';
export const SESSION_TTL_DAYS = 30;      // sliding: each authenticated request can extend it
export const MAGIC_LINK_TTL_MIN = 15;
export const APP_PATH = '/app';

// Canonical public origin. Security-sensitive absolute URLs (the magic-link
// sign-in URL that gets emailed) must be built from this, never from the
// request's Host header. Override with APP_ORIGIN for local dev / staging.
export const CANONICAL_ORIGIN = 'https://brambletally.com';
export const appOrigin = (env) => (env && env.APP_ORIGIN) || CANONICAL_ORIGIN;

// Overridable per-environment with MAIL_FROM. The domain must be
// verified in Resend before real sending works.
export const FROM_EMAIL = 'Brambletally <login@brambletally.com>';

// Bump when the Terms or Acceptable Use policy change materially: every user
// re-accepts at their next load. Compared against users.tos_version.
export const TOS_VERSION = '2026-09-07';

// Fallback zone for a user with no `users.timezone` set (migration 0013).
// Used to compute "today / tomorrow" for due-date reminders and to render
// server-side dates. Matches the app's historical implicit default.
export const DEFAULT_TZ = 'America/Los_Angeles';

// Cron trigger strings. These MUST stay byte-for-byte identical to the entries
// in wrangler.jsonc `triggers.crons` — scheduled() in worker/index.js dispatches
// by exact string match. If they drift, that job silently stops running (which
// is why the handler logs an unrecognized cron rather than falling through to a
// default job).
export const DIGEST_CRON = '0 15 * * 0'; // Sunday 15:00 UTC ≈ 08:00 America/Los_Angeles
export const REMINDERS_CRON = '0 12 * * *'; // daily 12:00 UTC
