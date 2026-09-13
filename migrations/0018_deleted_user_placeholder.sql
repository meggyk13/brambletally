-- 0018_deleted_user_placeholder.sql
-- Data-integrity hardening pass (docs/plan.md "Planned: Data-integrity
-- hardening pass", A1). DELETE /api/account reassigns the handful of
-- users(id) columns with no ON DELETE action (project_listings.created_by,
-- contributor_requests.decided_by, pending_invites.invited_by,
-- ownership_transfer_log.from_user_id/to_user_id, project_journal.user_id,
-- moderation_actions.admin_id, reports.resolved_by) onto this permanent
-- system row instead of leaving them dangling, then hard-deletes the real
-- user — same shape as the anonymous-claim merge already does for a real
-- target account.
--
-- Never logs in: no email, no handle, disabled_at set from creation so every
-- existing `disabled_at IS NULL` filter (users/search, board, feed) already
-- excludes it as an actor/owner for free.
--
-- Apply (local dev sqlite file):
--   npx wrangler d1 execute brambletally --local --file=./migrations/0018_deleted_user_placeholder.sql
-- Apply (production):
--   npx wrangler d1 execute brambletally --remote --file=./migrations/0018_deleted_user_placeholder.sql

INSERT INTO users (id, name, display_name, disabled_at)
SELECT 'deleted-user', 'Deleted user', 'Deleted user', datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = 'deleted-user');
