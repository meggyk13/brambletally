import { json, error, readJson } from '../lib/http.js';
import { uuid } from '../lib/id.js';
import { normalizeLinks } from '../lib/profile.js';

// PUT /api/profile/links — replace the caller's whole social-link set with the
// posted array. Body: { links: [{ platform, value }] }. Non-https values and
// rows past the cap are dropped by normalizeLinks; sort_order is the position.
export async function onRequestPut(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');

  const body = await readJson(context.request);
  const links = normalizeLinks(body && body.links);

  const stmts = [
    context.env.DB.prepare('DELETE FROM user_links WHERE user_id = ?').bind(me.id),
  ];
  for (const l of links) {
    stmts.push(
      context.env.DB.prepare(
        `INSERT INTO user_links (id, user_id, platform, value, sort_order)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(uuid(), me.id, l.platform, l.value, l.sort_order)
    );
  }
  await context.env.DB.batch(stmts);

  return json({ links: links.map((l) => ({ platform: l.platform, value: l.value })) });
}
