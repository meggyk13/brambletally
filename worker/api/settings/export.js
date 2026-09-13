import { error } from '../lib/http.js';
import { readNotifPrefs } from '../lib/notif.js';

// GET /api/settings/export — a JSON dump of everything tied to the caller's
// account: their profile (incl. links + interests), categories, inbox,
// shuffle state, notifications, planned focus sessions, and every project
// they own with its full contents, plus a reference list of projects shared
// with them.
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

  // Not scoped by project ownership like `forOwned` above — a planned focus
  // session belongs to whoever planned it, on any project they can reach
  // (owned or shared), so this queries by user_id directly.
  const workSessions = await all(
    'SELECT * FROM work_sessions WHERE user_id = ? ORDER BY starts_at',
    me.id
  );
  const userLinks = await all(
    'SELECT id, platform, value, sort_order FROM user_links WHERE user_id = ? ORDER BY sort_order',
    me.id
  );
  const interests = await all(
    `SELECT t.slug, t.label FROM user_interests ui
       JOIN interest_tags t ON t.id = ui.tag_id
      WHERE ui.user_id = ? ORDER BY t.label`,
    me.id
  );
  const shuffleState = await all(
    'SELECT box_key, last_shown_at, snoozed_until, dismissed_at FROM shuffle_state WHERE user_id = ?',
    me.id
  );
  const notifications = await all(
    'SELECT id, type, actor_id, subject_type, subject_id, preview, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY created_at',
    me.id
  );

  // avatar_url/timezone/tos_* already live on `me` (session.js's auth SELECT);
  // calendar_token/created_at don't, since that SELECT stays lean for every
  // request — a one-off lookup here instead of widening the hot path.
  const accountRow = await db
    .prepare('SELECT calendar_token, created_at FROM users WHERE id = ?')
    .bind(me.id)
    .first();

  const payload = {
    exported_at: new Date().toISOString(),
    account: {
      email: me.email,
      handle: me.handle,
      display_name: me.display_name,
      name: me.name,
      avatar_url: me.avatar_url,
      plan: me.plan,
      timezone: me.timezone,
      calendar_token: accountRow ? accountRow.calendar_token : null,
      created_at: accountRow ? accountRow.created_at : null,
      tos_accepted_at: me.tos_accepted_at,
      tos_version: me.tos_version,
    },
    profile: {
      bio: profileRow ? profileRow.bio : null,
      pronouns: profileRow ? profileRow.pronouns : null,
      notif_prefs: readNotifPrefs(profileRow && profileRow.notif_prefs),
      links: userLinks,
      interests: interests.map((i) => i.label),
    },
    categories,
    inbox,
    shuffle_state: shuffleState,
    notifications,
    work_sessions: workSessions,
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
