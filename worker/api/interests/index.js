import { json, error, readJson } from '../lib/http.js';
import { uuid } from '../lib/id.js';
import { normalizeInterestLabels } from '../lib/profile.js';

// GET /api/interests?q=  — tag autocomplete for the profile editor. With no
// query it returns the most-used tags as starter suggestions.
export async function onRequestGet(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');

  const q = (new URL(context.request.url).searchParams.get('q') || '').trim().toLowerCase();

  let rows;
  if (q.length < 1) {
    rows = await context.env.DB.prepare(
      `SELECT slug, label, usage_count FROM interest_tags
        WHERE usage_count > 0
        ORDER BY usage_count DESC, label COLLATE NOCASE LIMIT 10`
    ).all();
  } else {
    const like = `%${q}%`;
    rows = await context.env.DB.prepare(
      `SELECT slug, label, usage_count FROM interest_tags
        WHERE slug LIKE ? OR lower(label) LIKE ?
        ORDER BY usage_count DESC, label COLLATE NOCASE LIMIT 10`
    )
      .bind(like, like)
      .all();
  }

  return json({ tags: rows.results || [] });
}

// PUT /api/interests — replace the caller's whole interest set. Body:
// { labels: [string] }. Server slugs + dedupes + caps, upserts new tags into
// the shared index, and keeps interest_tags.usage_count exact for every tag it
// touched.
export async function onRequestPut(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');

  const body = await readJson(context.request);
  const wanted = normalizeInterestLabels(body && body.labels); // [{ slug, label }]
  const slugs = wanted.map((w) => w.slug);

  // Upsert every wanted tag, then resolve ids. ON CONFLICT keeps the original
  // label (first writer wins — matches the plan).
  if (slugs.length) {
    await context.env.DB.batch(
      wanted.map((w) =>
        context.env.DB.prepare(
          `INSERT INTO interest_tags (id, slug, label) VALUES (?, ?, ?)
           ON CONFLICT(slug) DO NOTHING`
        ).bind(uuid(), w.slug, w.label)
      )
    );
  }

  const ph = slugs.map(() => '?').join(',');
  const tagRows = slugs.length
    ? (
        await context.env.DB.prepare(
          `SELECT id, slug, label FROM interest_tags WHERE slug IN (${ph})`
        )
          .bind(...slugs)
          .all()
      ).results
    : [];
  const wantIds = new Set(tagRows.map((r) => r.id));

  const currentRows = (
    await context.env.DB.prepare('SELECT tag_id FROM user_interests WHERE user_id = ?')
      .bind(me.id)
      .all()
  ).results;
  const currentIds = new Set(currentRows.map((r) => r.tag_id));

  const toAdd = [...wantIds].filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !wantIds.has(id));
  const affected = [...new Set([...toAdd, ...toRemove])];

  if (affected.length) {
    const stmts = [];
    for (const id of toRemove) {
      stmts.push(
        context.env.DB.prepare(
          'DELETE FROM user_interests WHERE user_id = ? AND tag_id = ?'
        ).bind(me.id, id)
      );
    }
    for (const id of toAdd) {
      stmts.push(
        context.env.DB.prepare(
          `INSERT INTO user_interests (user_id, tag_id) VALUES (?, ?)
           ON CONFLICT(user_id, tag_id) DO NOTHING`
        ).bind(me.id, id)
      );
    }
    // Recompute usage after the writes above land in this same transaction.
    for (const id of affected) {
      stmts.push(
        context.env.DB.prepare(
          `UPDATE interest_tags SET usage_count =
             (SELECT COUNT(*) FROM user_interests WHERE tag_id = ?) WHERE id = ?`
        ).bind(id, id)
      );
    }
    await context.env.DB.batch(stmts);
  }

  // Return the canonical stored labels, in the order the caller sent them.
  const bySlug = new Map(tagRows.map((r) => [r.slug, r.label]));
  const interests = wanted
    .filter((w) => bySlug.has(w.slug))
    .map((w) => ({ slug: w.slug, label: bySlug.get(w.slug) }));
  return json({ interests });
}
