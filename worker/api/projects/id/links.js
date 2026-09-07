import { json, error, readJson } from '../../lib/http.js';
import { uuid } from '../../lib/id.js';
import { requireProject, touchStmt } from '../../lib/projects.js';
import { httpUrlOrNull, trimOrNull } from '../../lib/validate.js';

export async function onRequestGet(context) {
  const { id } = context.params;
  const g = await requireProject(context, id, 'viewer');
  if (g.fail) return g.fail;

  const { results } = await context.env.DB.prepare(
    'SELECT * FROM project_links WHERE project_id = ? ORDER BY sort_order, created_at'
  )
    .bind(id)
    .all();
  return json({ links: results });
}

export async function onRequestPost(context) {
  const { id } = context.params;
  const g = await requireProject(context, id, 'editor');
  if (g.fail) return g.fail;

  const body = await readJson(context.request);
  const url = httpUrlOrNull(body && body.url);
  if (!url) return error(400, 'A valid http(s) link is required');

  const linkId = uuid();
  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT INTO project_links (id, project_id, url, title, note)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(linkId, id, url, trimOrNull(body.title, 200), trimOrNull(body.note, 500)),
    touchStmt(context.env, id),
  ]);

  const link = await context.env.DB.prepare('SELECT * FROM project_links WHERE id = ?')
    .bind(linkId)
    .first();
  return json({ link }, { status: 201 });
}
