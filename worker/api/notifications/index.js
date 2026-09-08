import { json, error } from '../lib/http.js';

const PAGE = 20;

// GET /api/notifications?cursor=<offset> — the caller's notifications, newest
// first, with the unread count.
export async function onRequestGet(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');

  const offset = Math.max(
    0,
    parseInt(new URL(context.request.url).searchParams.get('cursor') || '0', 10) || 0
  );

  const [{ results }, unread] = await Promise.all([
    context.env.DB.prepare(
      `SELECT n.id, n.type, n.subject_type, n.subject_id, n.preview, n.read_at, n.created_at,
              a.handle AS actor_handle, a.display_name AS actor_display_name, a.name AS actor_name
         FROM notifications n
         LEFT JOIN users a ON a.id = n.actor_id
        WHERE n.user_id = ?
        ORDER BY n.created_at DESC
        LIMIT ? OFFSET ?`
    )
      .bind(me.id, PAGE + 1, offset)
      .all(),
    context.env.DB.prepare(
      'SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL'
    )
      .bind(me.id)
      .first(),
  ]);

  const hasMore = results.length > PAGE;
  const notifications = results.slice(0, PAGE).map((r) => ({
    id: r.id,
    type: r.type,
    subject_type: r.subject_type,
    subject_id: r.subject_id,
    preview: r.preview,
    read_at: r.read_at,
    created_at: r.created_at,
    actor: r.actor_handle
      ? { handle: r.actor_handle, display_name: r.actor_display_name, name: r.actor_name }
      : null,
  }));

  return json({
    notifications,
    unread_count: (unread && unread.n) || 0,
    next_cursor: hasMore ? String(offset + PAGE) : null,
  });
}
