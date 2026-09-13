-- 0017_claim_account.sql
-- Claiming an anonymous account by email (docs/plan.md "Planned: Guided
-- onboarding + zero-friction account creation", part C). Set only on a "save
-- your project" claim request; NULL for ordinary login/signup links. No
-- ON DELETE action — a used link with a since-merged-away claim_user_id is
-- fine to go stale, same as reports.target_id / shuffle_state.box_key.
--
-- Apply (local dev sqlite file):
--   npx wrangler d1 execute brambletally --local --file=./migrations/0017_claim_account.sql
-- Apply (production):
--   npx wrangler d1 execute brambletally --remote --file=./migrations/0017_claim_account.sql

ALTER TABLE magic_links ADD COLUMN claim_user_id TEXT REFERENCES users(id);
