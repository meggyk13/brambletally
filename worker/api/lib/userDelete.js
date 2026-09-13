import { DELETED_USER_ID } from './constants.js';

// Shared by DELETE /api/account (self) and the admin anonymous-account purge.
// `projects` cascades from `owner_id` on its own; these are the handful of
// users(id) columns with no ON DELETE action (docs/plan.md "Data-integrity
// hardening pass", A1) — reassign onto the permanent deleted-user placeholder
// (migration 0018) before the real DELETE.
export async function hasSharedOwnedProjects(env, userId) {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n
       FROM project_collaborators pc JOIN projects p ON p.id = pc.project_id
      WHERE p.owner_id = ? AND pc.user_id != ?`
  )
    .bind(userId, userId)
    .first();
  return !!(row && row.n > 0);
}

export function cascadeDeleteUserStatements(env, userId) {
  return [
    env.DB.prepare('UPDATE project_listings SET created_by = ? WHERE created_by = ?').bind(
      DELETED_USER_ID,
      userId
    ),
    env.DB.prepare('UPDATE contributor_requests SET decided_by = ? WHERE decided_by = ?').bind(
      DELETED_USER_ID,
      userId
    ),
    env.DB.prepare('UPDATE pending_invites SET invited_by = ? WHERE invited_by = ?').bind(
      DELETED_USER_ID,
      userId
    ),
    env.DB.prepare(
      'UPDATE ownership_transfer_log SET from_user_id = ? WHERE from_user_id = ?'
    ).bind(DELETED_USER_ID, userId),
    env.DB.prepare(
      'UPDATE ownership_transfer_log SET to_user_id = ? WHERE to_user_id = ?'
    ).bind(DELETED_USER_ID, userId),
    env.DB.prepare('UPDATE project_journal SET user_id = ? WHERE user_id = ?').bind(
      DELETED_USER_ID,
      userId
    ),
    env.DB.prepare('UPDATE moderation_actions SET admin_id = ? WHERE admin_id = ?').bind(
      DELETED_USER_ID,
      userId
    ),
    env.DB.prepare('UPDATE reports SET resolved_by = ? WHERE resolved_by = ?').bind(
      DELETED_USER_ID,
      userId
    ),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId),
  ];
}
