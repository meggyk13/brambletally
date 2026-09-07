import { json, error, readJson } from '../../../lib/http.js';
import { requireProject, touchStmt } from '../../../lib/projects.js';
import { pick, httpUrlOrNull, trimOrNull, intOrZero } from '../../../lib/validate.js';

export async function onRequestPatch(context) {
  const { id, linkId } = context.params;
  const g = await requireProject(context, id, 'editor');
  if (g.fail) return g.fail;

  const body = await readJson(context.request);
  if (!body) return error(400, 'Body required');

  const src = pick(body, ['url', 'title', 'note', 'sort_order']);
  const fields = {};
  if ('url' in src) {
    const u = httpUrlOrNull(src.url);
    if (!u) return error(400, 'A valid http(s) link is required');
    fields.url = u;
  }
  if ('title' in src) fields.title = trimOrNull(src.title, 200);
  if ('note' in src) fields.note = trimOrNull(src.note, 500);
  if ('sort_order' in src) fields.sort_order = intOrZero(src.sort_order);
  if (Object.keys(fields).length === 0) return error(400, 'Nothing to update');

  const owned = await context.env.DB.prepare(
    'SELECT id FROM project_links WHERE id = ? AND project_id = ?'
  )
    .bind(linkId, id)
    .first();
  if (!owned) return error(404, 'Link not found');

  const cols = Object.keys(fields);
  await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE project_links SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`
    ).bind(...cols.map((c) => fields[c]), linkId),
    touchStmt(context.env, id),
  ]);

  const link = await context.env.DB.prepare('SELECT * FROM project_links WHERE id = ?')
    .bind(linkId)
    .first();
  return json({ link });
}

export async function onRequestDelete(context) {
  const { id, linkId } = context.params;
  const g = await requireProject(context, id, 'editor');
  if (g.fail) return g.fail;

  const res = await context.env.DB.prepare(
    'DELETE FROM project_links WHERE id = ? AND project_id = ?'
  )
    .bind(linkId, id)
    .run();
  if (!res.meta.changes) return error(404, 'Link not found');

  await touchStmt(context.env, id).run();
  return json({ ok: true });
}
