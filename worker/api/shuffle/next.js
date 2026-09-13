import { json, error } from '../lib/http.js';
import { fetchCandidates, pickWeighted } from '../lib/shuffle.js';

// GET /api/shuffle/next — draw one card, weighted towards recently-touched
// projects with outstanding boxes, with a staleness boost so nothing is
// permanently buried. Marks the drawn box as shown.
export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user) return error(401, 'Not signed in');

  const db = context.env.DB;
  const candidates = await fetchCandidates(db, user.id);
  const picked = pickWeighted(candidates);
  if (!picked) return json({ card: null });

  await db
    .prepare(
      `INSERT INTO shuffle_state (user_id, box_key, last_shown_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(user_id, box_key) DO UPDATE SET last_shown_at = datetime('now')`
    )
    .bind(user.id, picked.box_key)
    .run();

  return json({ card: { box_key: picked.box_key, kind: picked.kind, ...picked.card } });
}
