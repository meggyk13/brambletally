import { FROM_EMAIL, MAGIC_LINK_TTL_MIN } from './constants.js';

// Generic transactional send via Resend. If RESEND_API_KEY is unset the message
// is logged instead, so email-dependent flows stay testable before Resend is
// configured. Returns { ok, skipped? }.
export async function sendEmail(env, { to, subject, text, html }) {
  if (!env.RESEND_API_KEY) {
    console.warn(`[brambletally] RESEND_API_KEY not set — email to ${to} (${subject}) not sent`);
    return { ok: true, skipped: true };
  }

  const from = env.MAIL_FROM || FROM_EMAIL;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, text, html: html || undefined }),
  });

  if (!r.ok) {
    const body = await r.text().catch(() => '');
    console.error(`[brambletally] Resend send failed: status=${r.status} body=${body}`);
    return { ok: false };
  }
  return { ok: true };
}

// Wrap body copy in the shared email shell.
export function emailShell(inner) {
  return (
    `<div style="font-family:-apple-system,system-ui,sans-serif;font-size:16px;line-height:1.5;color:#2D3436">` +
    inner +
    `</div>`
  );
}

// Sends the magic-link email. Falls back to a console log when Resend is unset.
export async function sendMagicLink(env, to, link) {
  const subject = 'Your Brambletally sign-in link';
  const text =
    `Here's your sign-in link for Brambletally:\n\n${link}\n\n` +
    `It works once and expires in ${MAGIC_LINK_TTL_MIN} minutes. ` +
    `If you didn't ask to sign in, ignore this email.`;
  const html = emailShell(
    `<p>Here's your sign-in link for Brambletally.</p>` +
      `<p><a href="${link}" style="color:#6B8E23">Sign in</a></p>` +
      `<p style="color:#6b7280;font-size:14px">It works once and expires in ${MAGIC_LINK_TTL_MIN} minutes. ` +
      `If you didn't ask to sign in, ignore this email.</p>`
  );

  if (!env.RESEND_API_KEY) {
    console.warn(`[brambletally] RESEND_API_KEY not set — magic link for ${to}:\n${link}`);
    return { ok: true, skipped: true };
  }
  return sendEmail(env, { to, subject, text, html });
}
