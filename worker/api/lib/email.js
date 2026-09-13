import { FROM_EMAIL, MAGIC_LINK_TTL_MIN, INVITE_LINK_TTL_DAYS } from './constants.js';

// Matches --accent (elderberry) in public/app.css's default theme — the link
// color in every email, so it doesn't drift from the app's actual brand color.
export const EMAIL_LINK_COLOR = '#6b3457';

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

const escapeHtml = (s) =>
  String(s == null ? '' : s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

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
      `<p><a href="${link}" style="color:${EMAIL_LINK_COLOR}">Sign in</a></p>` +
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
      `<p><a href="${link}" style="color:${EMAIL_LINK_COLOR}">Confirm new email</a></p>` +
      `<p style="color:#6b7280;font-size:14px">It works once and expires in ${MAGIC_LINK_TTL_MIN} minutes. ` +
      `If you didn't ask to change your email, ignore this — nothing changes until the link is used.</p>`
  );

  if (!env.RESEND_API_KEY) {
    console.warn(`[brambletally] RESEND_API_KEY not set — email-change link for ${to}:\n${link}`);
    return { ok: true, skipped: true };
  }
  return sendEmail(env, { to, subject, text, html });
}

// Invite email for a brand-new address added as a project collaborator —
// creates the account immediately (docs/plan.md onboarding part D), so this
// doubles as their first-ever email from Brambletally. Distinct from
// sendMagicLink: names the inviter and project, and explains the account
// exists now rather than reading like a plain sign-in link.
export async function sendCollaboratorInvite(env, to, link, { inviterName, projectTitle, role }) {
  const subject = `${inviterName} invited you to "${projectTitle}" on Brambletally`;
  const roleLine = role === 'editor' ? 'as an editor' : 'to view it';
  const text =
    `${inviterName} added you ${roleLine} on their Brambletally project "${projectTitle}".\n\n` +
    `Brambletally is a project tracker. We've created an account for you at this address — ` +
    `use the link below to sign in and take a look:\n\n${link}\n\n` +
    `It works once and expires in ${INVITE_LINK_TTL_DAYS} days. ` +
    `If you weren't expecting this, you can ignore it.`;
  const html = emailShell(
    `<p>${escapeHtml(inviterName)} added you ${roleLine} on their Brambletally project ` +
      `<strong>${escapeHtml(projectTitle)}</strong>.</p>` +
      `<p>Brambletally is a project tracker. We've created an account for you at this address — ` +
      `use the link below to sign in and take a look.</p>` +
      `<p><a href="${link}" style="color:${EMAIL_LINK_COLOR}">View "${escapeHtml(projectTitle)}"</a></p>` +
      `<p style="color:#6b7280;font-size:14px">It works once and expires in ${INVITE_LINK_TTL_DAYS} days. ` +
      `If you weren't expecting this, you can ignore it.</p>`
  );

  if (!env.RESEND_API_KEY) {
    console.warn(`[brambletally] RESEND_API_KEY not set — invite link for ${to}:\n${link}`);
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
