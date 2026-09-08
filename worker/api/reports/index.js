import { json, error, readJson } from '../lib/http.js';
import { uuid } from '../lib/id.js';
import { trimOrNull } from '../lib/validate.js';
import { verifyTurnstile } from '../lib/turnstile.js';
import { sendEmail } from '../lib/email.js';
import { appOrigin } from '../lib/constants.js';
import { REPORT_DAILY_CAP, TURNSTILE_UNTIL_ACTIONS, boardActionCount } from '../lib/board.js';

const TARGET_TYPES = ['listing', 'comment', 'profile'];
const CATEGORIES = ['spam', 'harassment', 'illegal', 'other'];

// POST /api/reports — { targetType, targetId, category, detail?, turnstileToken? }.
// A board block does NOT stop reporting. One open report per reporter+target.
// Rolling daily cap; a Turnstile token is required for a caller's first few
// board actions.
export async function onRequestPost(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');

  const body = await readJson(context.request);
  const targetType = body && body.targetType;
  const rawTargetId = body && typeof body.targetId === 'string' ? body.targetId.trim() : '';
  const category = body && body.category;
  const detail = trimOrNull(body && body.detail, 1000);

  if (!TARGET_TYPES.includes(targetType)) return error(400, 'Bad targetType');
  if (!CATEGORIES.includes(category)) return error(400, 'Pick a category');
  if (!rawTargetId) return error(400, 'Missing targetId');

  // Resolve + verify the target. For a profile the client sends a handle; we
  // store the user id so the report survives a handle change.
  let targetId = rawTargetId;
  let targetAuthorId = null;
  if (targetType === 'listing') {
    const row = await context.env.DB.prepare(
      `SELECT l.id, p.owner_id FROM project_listings l
         JOIN projects p ON p.id = l.project_id WHERE l.id = ?`
    )
      .bind(rawTargetId)
      .first();
    if (!row) return error(404, 'That listing no longer exists');
    targetAuthorId = row.owner_id;
  } else if (targetType === 'comment') {
    const row = await context.env.DB.prepare(
      'SELECT id, user_id FROM listing_comments WHERE id = ?'
    )
      .bind(rawTargetId)
      .first();
    if (!row) return error(404, 'That comment no longer exists');
    targetAuthorId = row.user_id;
  } else {
    let handle = rawTargetId.toLowerCase();
    if (handle.startsWith('@')) handle = handle.slice(1);
    const row = await context.env.DB.prepare('SELECT id FROM users WHERE handle = ?')
      .bind(handle)
      .first();
    if (!row) return error(404, 'No such account');
    targetId = row.id;
    targetAuthorId = row.id;
  }

  if (targetAuthorId === me.id) return error(400, "You can't report your own content");

  // Turnstile for new accounts.
  const actions = await boardActionCount(context.env, me.id);
  if (actions < TURNSTILE_UNTIL_ACTIONS) {
    const ts = await verifyTurnstile(
      context.env,
      body && body.turnstileToken,
      context.request.headers.get('CF-Connecting-IP')
    );
    if (!ts.ok) return error(400, 'Please complete the challenge and try again.', { turnstile: true });
  }

  const recent = await context.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM reports
      WHERE reporter_id = ? AND created_at > datetime('now', '-1 day')`
  )
    .bind(me.id)
    .first();
  if ((recent.n || 0) >= REPORT_DAILY_CAP)
    return error(429, 'You’ve filed a lot of reports today. Try again tomorrow.');

  const open = await context.env.DB.prepare(
    `SELECT id FROM reports
      WHERE reporter_id = ? AND target_type = ? AND target_id = ? AND status = 'open'`
  )
    .bind(me.id, targetType, targetId)
    .first();
  if (open) return error(409, 'You already have an open report on this.');

  const id = uuid();
  await context.env.DB.prepare(
    `INSERT INTO reports (id, reporter_id, target_type, target_id, category, detail)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(id, me.id, targetType, targetId, category, detail)
    .run();

  // Optional immediate ping to the admin mailbox.
  if (context.env.ADMIN_EMAIL) {
    const url = appOrigin(context.env) + '/app';
    context.waitUntil(
      sendEmail(context.env, {
        to: context.env.ADMIN_EMAIL,
        subject: `New report: ${category} on a ${targetType}`,
        text: `A new ${category} report was filed on a ${targetType}.\n\n${
          detail ? detail + '\n\n' : ''
        }Review it in the admin panel: ${url}`,
      }).catch(() => {})
    );
  }

  return json({ ok: true }, { status: 201 });
}
