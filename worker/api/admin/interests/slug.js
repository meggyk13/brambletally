import { json, error, readJson } from '../../lib/http.js';
import { requireAdmin } from '../../lib/admin.js';
import { slugify } from '../../lib/profile.js';

// PATCH /api/admin/interests/:slug — body { label?, slug? }. Rename the display
// label and/or re-key the slug. A slug collision with another tag is a 409.
export async function onRequestPatch(context) {
  const g = requireAdmin(context);
  if (g.fail) return g.fail;

  const cur = String(context.params.slug || '').trim().toLowerCase();
  const tag = await context.env.DB.prepare(
    'SELECT id, slug, label FROM interest_tags WHERE slug = ?'
  )
    .bind(cur)
    .first();
  if (!tag) return error(404, 'No such tag');

  const body = await readJson(context.request);
  if (!body) return error(400, 'Body required');

  const fields = {};
  if ('label' in body) {
    const label = String(body.label || '').trim().slice(0, 60);
    if (!label) return error(400, 'Label cannot be empty');
    fields.label = label;
  }
  if ('slug' in body) {
    const next = slugify(String(body.slug || ''));
    if (!next) return error(400, 'That slug is empty after normalising');
    if (next !== tag.slug) {
      const clash = await context.env.DB.prepare(
        'SELECT 1 FROM interest_tags WHERE slug = ? AND id != ?'
      )
        .bind(next, tag.id)
        .first();
      if (clash) return error(409, `A tag already uses the slug "${next}" — merge instead`);
      fields.slug = next;
    }
  }
  if (Object.keys(fields).length === 0) return error(400, 'Nothing to update');

  const cols = Object.keys(fields);
  await context.env.DB.prepare(
    `UPDATE interest_tags SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`
  )
    .bind(...cols.map((c) => fields[c]), tag.id)
    .run();

  const updated = await context.env.DB.prepare(
    'SELECT id, slug, label, usage_count FROM interest_tags WHERE id = ?'
  )
    .bind(tag.id)
    .first();
  return json({ tag: updated });
}

// DELETE /api/admin/interests/:slug — drop a junk tag. user_interests rows
// cascade (FK), unlinking it from every profile that had it.
export async function onRequestDelete(context) {
  const g = requireAdmin(context);
  if (g.fail) return g.fail;

  const cur = String(context.params.slug || '').trim().toLowerCase();
  const res = await context.env.DB.prepare('DELETE FROM interest_tags WHERE slug = ?')
    .bind(cur)
    .run();
  if (!res.meta.changes) return error(404, 'No such tag');
  return json({ ok: true });
}
