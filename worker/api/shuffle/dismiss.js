import { json, error, readJson } from '../lib/http.js';
import { BOX_KEY_RE } from '../lib/shuffle.js';

// POST /api/shuffle/dismiss { box_key } — "not applicable". Hidden from
// future draws for good (until the object changes enough to mint a new
// box_key, e.g. a project's next open step moves on).
export async function onRequestPost(context) {
  const user = context.data.user;
  if (!user) return error(401, 'Not signed in');

  const body = await readJson(context.request);
  if (!body || typeof body.box_key !== 'string' || !BOX_KEY_RE.test(body.box_key)) {
    return error(400, 'Valid box_key required');
  }

  await context.env.DB.prepare(
    `INSERT INTO shuffle_state (user_id, box_key, dismissed_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(user_id, box_key) DO UPDATE SET dismissed_at = datetime('now')`
  )
    .bind(user.id, body.box_key)
    .run();

  return json({ ok: true });
}
