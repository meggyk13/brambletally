import { uuid } from './id.js';
import { blockedBetween } from './blocks.js';
import { readNotifPrefs } from './notif.js';
import { sendEmail, emailShell } from './email.js';
import { appOrigin } from './constants.js';

const appUrl = (env) => appOrigin(env) + '/app';

const escapeHtml = (s) =>
  String(s == null ? '' : s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

// Subject + one-line body per notification type. `preview` carries the
// type-specific detail (comment excerpt, 'accepted'/'declined', …).
export function notifCopy(type, actorName, preview) {
  const q = preview ? `: “${preview}”` : '';
  switch (type) {
    case 'follow':
      return { subject: `${actorName} started following you`, line: `${actorName} started following you.` };
    case 'contributor_request':
      return {
        subject: `${actorName} asked to contribute`,
        line: `${actorName} asked to contribute to your listing${q}.`,
      };
    case 'contributor_decided':
      return {
        subject: `Your contributor request was ${preview || 'decided'}`,
        line: `Your request to contribute was ${preview || 'decided'}.`,
      };
    case 'board_comment':
      return { subject: `${actorName} commented on your listing`, line: `${actorName} commented on your listing${q}.` };
    case 'board_reply':
      return { subject: `${actorName} replied to your comment`, line: `${actorName} replied to your comment${q}.` };
    case 'step_assigned':
      return {
        subject: `${actorName} assigned you a step`,
        line: `${actorName} assigned you a step${q}.`,
      };
    default:
      return { subject: 'New activity on Brambletally', line: 'You have new activity.' };
  }
}

async function actorDisplayName(env, actorId) {
  if (!actorId) return 'Someone';
  const a = await env.DB.prepare(
    'SELECT display_name, name, handle FROM users WHERE id = ?'
  )
    .bind(actorId)
    .first();
  return (a && (a.display_name || a.name || (a.handle ? '@' + a.handle : null))) || 'Someone';
}

// Write a notification and, for 'immediate' recipients, email it. Never throws —
// a notification failure must not fail the action that triggered it. Skips when:
// recipient is the actor, recipient is disabled, the type is turned off in
// notif_prefs (no row at all), or a block exists either direction.
export async function notify(
  context,
  { recipientId, actorId, type, subjectType, subjectId, preview }
) {
  const { env } = context;
  try {
    if (!recipientId || recipientId === actorId) return;

    const recip = await env.DB.prepare(
      `SELECT u.email, p.notif_prefs
         FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id
        WHERE u.id = ? AND u.disabled_at IS NULL`
    )
      .bind(recipientId)
      .first();
    if (!recip) return;

    const prefs = readNotifPrefs(recip.notif_prefs);
    if (prefs.types && prefs.types[type] === false) return;
    if (actorId && (await blockedBetween(env, recipientId, actorId))) return;

    const id = uuid();
    await env.DB.prepare(
      `INSERT INTO notifications (id, user_id, type, actor_id, subject_type, subject_id, preview)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, recipientId, type, actorId || null, subjectType || null, subjectId || null, preview || null)
      .run();

    if (prefs.mode === 'immediate' && recip.email) {
      const actorName = await actorDisplayName(env, actorId);
      const { subject, line } = notifCopy(type, actorName, preview);
      const url = appUrl(env);
      const html = emailShell(
        `<p>${escapeHtml(line)}</p><p><a href="${url}" style="color:#6B8E23">Open Brambletally</a></p>`
      );
      const text = `${line}\n\n${url}`;
      const send = async () => {
        const r = await sendEmail(env, { to: recip.email, subject, text, html });
        if (r && r.ok && !r.skipped) {
          await env.DB.prepare(
            "UPDATE notifications SET emailed_at = datetime('now') WHERE id = ?"
          )
            .bind(id)
            .run();
        }
      };
      if (context.waitUntil) context.waitUntil(send());
      else await send();
    }
  } catch (e) {
    console.error('[brambletally] notify failed', type, e);
  }
}
