import { json, error, readJson } from '../../../lib/http.js';
import { uuid } from '../../../lib/id.js';
import { requireAdmin } from '../../../lib/admin.js';
import { trimOrNull } from '../../../lib/validate.js';

const PLANS = ['free', 'supporter'];

// POST /api/admin/users/:handle/plan — { plan: 'free' | 'supporter', note? }.
// Manual Supporter grant/revoke — the stand-in for billing until a payment
// processor is wired up (docs/social-plan.md "Supporter tier"). Logged to
// moderation_actions so it shows in the same admin-panel history as sanctions.
export async function onRequestPost(context) {
  const g = requireAdmin(context);
  if (g.fail) return g.fail;
  const me = g.user;

  let handle = String(context.params.handle || '').trim().toLowerCase();
  if (handle.startsWith('@')) handle = handle.slice(1);

  const body = await readJson(context.request);
  const plan = body && body.plan;
  if (!PLANS.includes(plan)) return error(400, 'Unknown plan');
  const note = trimOrNull(body && body.note, 1000);

  const target = await context.env.DB.prepare('SELECT id, plan FROM users WHERE handle = ?')
    .bind(handle)
    .first();
  if (!target) return error(404, 'No such account');
  if (target.plan === plan) return error(400, `Already ${plan}`);

  const action = plan === 'supporter' ? 'grant_supporter' : 'revoke_supporter';
  await context.env.DB.batch([
    context.env.DB.prepare('UPDATE users SET plan = ? WHERE id = ?').bind(plan, target.id),
    context.env.DB.prepare(
      `INSERT INTO moderation_actions (id, admin_id, target_user_id, report_id, action, note)
       VALUES (?, ?, ?, NULL, ?, ?)`
    ).bind(uuid(), me.id, target.id, action, note),
  ]);

  return json({ ok: true, plan });
}
