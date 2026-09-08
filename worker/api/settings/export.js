import { error } from '../lib/http.js';
import { readNotifPrefs } from '../lib/notif.js';

// GET /api/settings/export — a JSON dump of everything tied to the caller's
// account: their profile, categories, inbox, and every project they own with
// its full contents, plus a reference list of projects shared with them.
export async function onRequestGet(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');
  const db = context.env.DB;

  const all = (sql, ...binds) => db.prepare(sql).bind(...binds).all().then((r) => r.results);

  const profileRow = await db
    .prepare('SELECT bio, pronouns, notif_prefs, updated_at FROM user_profiles WHERE user_id = ?')
    .bind(me.id)
    .first();

  const owned = await all('SELECT * FROM projects WHERE owner_id = ? ORDER BY created_at', me.id);
  const ownedIds = owned.map((p) => p.id);

  const forOwned = async (table, order = 'created_at') => {
    if (!ownedIds.length) return [];
    const marks = ownedIds.map(() => '?').join(',');
    return all(
      `SELECT * FROM ${table} WHERE project_id IN (${marks}) ORDER BY project_id, ${order}`,
      ...ownedIds
    );
  };

  const [steps, supplies, links, journal, collaborators] = await Promise.all([
    forOwned('project_steps', 'sort_order, created_at'),
    forOwned('project_supplies'),
    forOwned('project_links', 'sort_order, created_at'),
    forOwned('project_journal'),
    forOwned('project_collaborators', 'added_at'),
  ]);

  const byPid = (rows) => {
    const m = {};
    for (const r of rows) (m[r.project_id] ||= []).push(r);
    return m;
  };
  const s = byPid(steps),
    su = byPid(supplies),
    li = byPid(links),
    j = byPid(journal),
    c = byPid(collaborators);

  const projects = owned.map((p) => ({
    ...p,
    steps: s[p.id] || [],
    supplies: su[p.id] || [],
    links: li[p.id] || [],
    journal: j[p.id] || [],
    collaborators: c[p.id] || [],
  }));

  const sharedWithMe = await all(
    `SELECT p.id, p.title, pc.role, pc.added_at
       FROM project_collaborators pc JOIN projects p ON p.id = pc.project_id
      WHERE pc.user_id = ? AND p.owner_id != ?
      ORDER BY pc.added_at`,
    me.id,
    me.id
  );

  const categories = await all(
    'SELECT id, name, sort_order, created_at FROM categories WHERE user_id = ? ORDER BY sort_order',
    me.id
  );
  const inbox = await all(
    'SELECT id, text, created_at FROM inbox_items WHERE user_id = ? ORDER BY created_at',
    me.id
  );

  const payload = {
    exported_at: new Date().toISOString(),
    account: {
      email: me.email,
      handle: me.handle,
      display_name: me.display_name,
      name: me.name,
      plan: me.plan,
    },
    profile: {
      bio: profileRow ? profileRow.bio : null,
      pronouns: profileRow ? profileRow.pronouns : null,
      notif_prefs: readNotifPrefs(profileRow && profileRow.notif_prefs),
    },
    categories,
    inbox,
    projects,
    shared_with_me: sharedWithMe,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="brambletally-export.json"',
    },
  });
}
