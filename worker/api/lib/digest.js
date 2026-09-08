import { readNotifPrefs } from './notif.js';
import { sendEmail, emailShell } from './email.js';
import { notifCopy } from './notify.js';
import { appOrigin } from './constants.js';

const MAX_LINES = 12;

const escapeHtml = (s) =>
  String(s == null ? '' : s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

// Weekly digest — fired by the Sunday cron. One email per user whose
// notif_prefs.mode is 'weekly' and who has notifications not yet emailed. Groups
// this week's activity, sends one summary, stamps emailed_at on those rows.
// notif_prefs is JSON on user_profiles, so the weekly filter happens in JS.
export async function runWeeklyDigest(env) {
  const { results: rows } = await env.DB.prepare(
    `SELECT n.id, n.type, n.preview, n.created_at, n.user_id,
            u.email, p.notif_prefs,
            a.display_name AS actor_display_name, a.name AS actor_name, a.handle AS actor_handle
       FROM notifications n
       JOIN users u ON u.id = n.user_id
       LEFT JOIN user_profiles p ON p.user_id = n.user_id
       LEFT JOIN users a ON a.id = n.actor_id
      WHERE n.emailed_at IS NULL
        AND u.disabled_at IS NULL
        AND n.created_at > datetime('now', '-8 days')
      ORDER BY n.user_id, n.created_at DESC`
  ).all();

  const byUser = new Map();
  for (const r of rows || []) {
    if (readNotifPrefs(r.notif_prefs).mode !== 'weekly') continue;
    if (!r.email) continue;
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, { email: r.email, items: [] });
    byUser.get(r.user_id).items.push(r);
  }

  const url = appOrigin(env) + '/app';
  let sent = 0;

  for (const [, { email, items }] of byUser) {
    const lines = items.slice(0, MAX_LINES).map((r) => {
      const actorName =
        r.actor_display_name || r.actor_name || (r.actor_handle ? '@' + r.actor_handle : 'Someone');
      return notifCopy(r.type, actorName, r.preview).line;
    });
    const extra = items.length - lines.length;

    const text =
      `Your week on Brambletally:\n\n` +
      lines.map((l) => `• ${l}`).join('\n') +
      (extra > 0 ? `\n• …and ${extra} more` : '') +
      `\n\n${url}`;
    const html = emailShell(
      `<p>Your week on Brambletally:</p><ul>` +
        lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('') +
        (extra > 0 ? `<li>…and ${extra} more</li>` : '') +
        `</ul><p><a href="${url}" style="color:#6B8E23">Open Brambletally</a></p>`
    );

    const r = await sendEmail(env, {
      to: email,
      subject: `Your week on Brambletally — ${items.length} update${items.length === 1 ? '' : 's'}`,
      text,
      html,
    });
    // Only stamp once a real email went out, so a run before Resend is
    // configured doesn't silently swallow the week's activity.
    if (r && r.ok && !r.skipped) {
      const ids = items.map((it) => it.id);
      const ph = ids.map(() => '?').join(',');
      await env.DB.prepare(
        `UPDATE notifications SET emailed_at = datetime('now') WHERE id IN (${ph})`
      )
        .bind(...ids)
        .run();
      sent++;
    }
  }

  console.log(`[brambletally] weekly digest: ${sent} email(s), ${byUser.size} candidate user(s)`);
  return { sent, candidates: byUser.size };
}
