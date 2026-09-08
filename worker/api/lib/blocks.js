// user_blocks helpers. A block is symmetric in effect: if either side has
// blocked the other, they don't see each other in search, profiles, or
// discovery.

// True if a block exists in either direction between two user ids.
export async function blockedBetween(env, a, b) {
  if (!a || !b || a === b) return false;
  const row = await env.DB.prepare(
    `SELECT 1 FROM user_blocks
      WHERE (blocker_id = ?1 AND blocked_id = ?2)
         OR (blocker_id = ?2 AND blocked_id = ?1)
      LIMIT 1`
  )
    .bind(a, b)
    .first();
  return !!row;
}

// SQL fragment for list queries: keeps rows whose user-id column is not blocked
// either direction relative to the caller. `userCol` is the column expression
// (e.g. "u.id"); the caller binds the caller's id twice, in order, where the
// two "?" land.
export const notBlockedSql = (userCol) =>
  `NOT EXISTS (SELECT 1 FROM user_blocks b
     WHERE (b.blocker_id = ? AND b.blocked_id = ${userCol})
        OR (b.blocked_id = ? AND b.blocker_id = ${userCol}))`;
