import { json, error, readJson } from '../../lib/http.js';
import { requireAdmin } from '../../lib/admin.js';

// POST /api/admin/interests/merge — body { fromSlug, toSlug }. Repoints every
// user_interests row from the loser to the winner, drops rows for users who
// already had the winner, recomputes the winner's usage_count, and deletes the
// loser tag. One batch.
export async function onRequestPost(context) {
  const g = requireAdmin(context);
  if (g.fail) return g.fail;

  const body = await readJson(context.request);
  const fromSlug = String((body && body.fromSlug) || '').trim().toLowerCase();
  const toSlug = String((body && body.toSlug) || '').trim().toLowerCase();
  if (!fromSlug || !toSlug) return error(400, 'fromSlug and toSlug are required');
  if (fromSlug === toSlug) return error(400, 'Pick two different tags');

  const [loser, winner] = await Promise.all([
    context.env.DB.prepare('SELECT id FROM interest_tags WHERE slug = ?').bind(fromSlug).first(),
    context.env.DB.prepare('SELECT id FROM interest_tags WHERE slug = ?').bind(toSlug).first(),
  ]);
  if (!loser) return error(404, `No tag "${fromSlug}"`);
  if (!winner) return error(404, `No tag "${toSlug}"`);

  await context.env.DB.batch([
    // Move what can move; a user who already had the winner keeps that row.
    context.env.DB.prepare(
      'UPDATE OR IGNORE user_interests SET tag_id = ? WHERE tag_id = ?'
    ).bind(winner.id, loser.id),
    // Clean up the rows that couldn't move (PK collision left them on the loser).
    context.env.DB.prepare('DELETE FROM user_interests WHERE tag_id = ?').bind(loser.id),
    context.env.DB.prepare(
      `UPDATE interest_tags SET usage_count =
         (SELECT COUNT(*) FROM user_interests WHERE tag_id = ?) WHERE id = ?`
    ).bind(winner.id, winner.id),
    context.env.DB.prepare('DELETE FROM interest_tags WHERE id = ?').bind(loser.id),
  ]);

  const tag = await context.env.DB.prepare(
    'SELECT id, slug, label, usage_count FROM interest_tags WHERE id = ?'
  )
    .bind(winner.id)
    .first();
  return json({ tag });
}
