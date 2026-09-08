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

// Confirm link for an email change, sent to the NEW address.
export async function sendEmailChangeLink(env, to, link) {
  const subject = 'Confirm your new Brambletally email';
  const text =
    `Confirm this address for your Brambletally account:\n\n${link}\n\n` +
    `It works once and expires in ${MAGIC_LINK_TTL_MIN} minutes. ` +
    `If you didn't ask to change your email, ignore this — nothing changes until the link is used.`;
  const html = emailShell(
    `<p>Confirm this address for your Brambletally account.</p>` +
      `<p><a href="${link}" style="color:#6B8E23">Confirm new email</a></p>` +
      `<p style="color:#6b7280;font-size:14px">It works once and expires in ${MAGIC_LINK_TTL_MIN} minutes. ` +
      `If you didn't ask to change your email, ignore this — nothing changes until the link is used.</p>`
  );

  if (!env.RESEND_API_KEY) {
    console.warn(`[brambletally] RESEND_API_KEY not set — email-change link for ${to}:\n${link}`);
    return { ok: true, skipped: true };
  }
  return sendEmail(env, { to, subject, text, html });
}

// Heads-up to the OLD address after an email change lands.
export async function sendEmailChangedNotice(env, to, newEmail) {
  const subject = 'Your Brambletally email was changed';
  const text =
    `The email on your Brambletally account was changed to ${newEmail}.\n\n` +
    `If this was you, no action is needed. If not, reply to this message right away.`;
  const html = emailShell(
    `<p>The email on your Brambletally account was changed to <strong>${newEmail}</strong>.</p>` +
      `<p style="color:#6b7280;font-size:14px">If this was you, no action is needed. If not, reply to this message right away.</p>`
  );
  return sendEmail(env, { to, subject, text, html });
}
