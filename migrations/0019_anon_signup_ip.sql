-- 0019_anon_signup_ip.sql
-- Anonymous signups (POST /api/auth/anonymous) create a real `users` row with
-- no email and no Turnstile-verified identity beyond "passed the bot check
-- once" — the only trail if one IP starts mass-creating accounts/projects is
-- request logs. Record the creating IP so abuse (spam, ban evasion) is at
-- least traceable after the fact. Nullable, unindexed: this is a forensic
-- field for manual/admin lookups, not a query path, and it's never set for a
-- normal email signup (worker/api/auth/callback.js) — only anonymous.js
-- writes it.
--
-- Apply (local dev sqlite file):
--   npx wrangler d1 execute brambletally --local --file=./migrations/0019_anon_signup_ip.sql
-- Apply (production):
--   npx wrangler d1 execute brambletally --remote --file=./migrations/0019_anon_signup_ip.sql

ALTER TABLE users ADD COLUMN signup_ip TEXT;
