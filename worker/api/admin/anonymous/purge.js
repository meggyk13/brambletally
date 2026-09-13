import { json, error, readJson } from '../../lib/http.js';
import { requireAdmin } from '../../lib/admin.js';
import { hasSharedOwnedProjects, cascadeDeleteUserStatements } from '../../lib/userDelete.js';

const MAX_PER_CALL = 200; // keep each D1 batch bounded; re-run to purge more

// POST /api/admin/anonymous/purge { olderThanDays } — bulk-delete never-claimed
// (email IS NULL) accounts older than the cutoff. Deferred in docs/plan.md
// "no purge job yet" (2026-09-12); this is the admin-panel version of that job
// rather than an unattended cron, so a human decides when and how far back.
// Skips (doesn't fail the whole call on) any account that owns a shared
// project, same guard as the single-account delete.
export async function onRequestPost(context) {
  const g = requireAdmin(context);
  if (g.fail) return g.fail;
  const { env, request } = context;

  const body = (await readJson(request)) || {};
  const days = Number(body.olderThanDays);
  if (!Number.isFinite(days) || days < 1) return error(400, 'olderThanDays must be a positive number');

  const { results } = await env.DB.prepare(
    `SELECT id FROM users
      WHERE email IS NULL
        AND created_at <= datetime('now', ?)
      ORDER BY created_at ASC
      LIMIT ?`
  )
    .bind(`-${days} days`, MAX_PER_CALL)
    .all();

  const BATCH_CHUNK_USERS = 20; // keep each D1 batch call well under any statement-count limit

  let purged = 0;
  let skipped = 0;
  let pending = [];
  for (const row of results) {
    if (await hasSharedOwnedProjects(env, row.id)) {
      skipped++;
      continue;
    }
    pending.push(...cascadeDeleteUserStatements(env, row.id));
    purged++;
    if (pending.length >= BATCH_CHUNK_USERS * 10) {
      await env.DB.batch(pending);
      pending = [];
    }
  }
  if (pending.length) await env.DB.batch(pending);

  // Re-running only helps if this call actually purged something — if every
  // candidate in a full page was skipped (all own a shared project), the next
  // call would fetch the exact same rows and make the same zero progress.
  return json({ purged, skipped, remaining: purged > 0 && results.length === MAX_PER_CALL });
}
