// Brambletally API — Cloudflare Worker entry.
//
// The site deploys as a Worker with static assets: requests that match a file
// in ./dist are served by the edge before this runs, so `fetch` only sees
// paths with no matching asset. We handle /api/* here and 404 the rest.

import { routes } from './routes.js';
import { loadSession } from './api/session.js';
import { error } from './api/lib/http.js';
import { runWeeklyDigest } from './api/lib/digest.js';
import { needsTos } from './api/lib/legal.js';

// Reachable while a sanction / acceptance gate is in force: sign-in state, a
// way out, and the data-subject routes (export, delete) which must never be
// walled off.
const DISABLED_OK = new Set([
  '/api/auth/me',
  '/api/auth/logout',
  '/api/settings/export',
  '/api/account',
]);
// The above, plus the accept endpoint itself.
const TOS_OK = new Set([...DISABLED_OK, '/api/legal/accept']);

// decodeURIComponent throws on a malformed %-escape; a bad path segment should
// just fail to match (-> 404), never crash the request.
function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function matchRoute(pathname) {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const uSeg = clean.split('/');
  for (const [pattern, mod] of routes) {
    const pSeg = pattern.split('/');
    if (pSeg.length !== uSeg.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < pSeg.length; i++) {
      if (pSeg[i].startsWith(':')) {
        params[pSeg[i].slice(1)] = safeDecode(uSeg[i]);
      } else if (pSeg[i] !== uSeg[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { mod, params };
  }
  return null;
}

const handlerFor = (mod, method) => {
  const name = 'onRequest' + method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();
  return mod[name] || mod.onRequest || null;
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS
        ? env.ASSETS.fetch(request)
        : new Response('Not found', { status: 404 });
    }

    const match = matchRoute(url.pathname);
    if (!match) return error(404, 'Not found');

    const handler = handlerFor(match.mod, request.method);
    if (!handler) return error(405, 'Method not allowed');

    const context = {
      request,
      env,
      params: match.params,
      data: {},
      waitUntil: ctx.waitUntil.bind(ctx),
    };

    let slideCookie;
    try {
      ({ slideCookie } = await loadSession(context));
    } catch (e) {
      console.error('[brambletally] session load failed', e);
    }

    // Hard sanction: users.disabled_at 403s every route except the ones the
    // client needs to show the "suspended" screen, leave, and exercise
    // data-subject rights (export, delete).
    if (
      context.data.user &&
      context.data.user.disabled_at &&
      !DISABLED_OK.has(url.pathname)
    ) {
      return error(403, 'This account is suspended');
    }

    // Acceptance gate: a signed-in user who hasn't accepted the current Terms
    // is held to the same small allowlist until they do. The client renders the
    // acceptance screen off the needs_tos flag on /api/auth/me.
    if (
      context.data.user &&
      needsTos(context.data.user) &&
      !TOS_OK.has(url.pathname)
    ) {
      return error(403, 'Accept the current Terms to continue', { needs_tos: true });
    }

    let res;
    try {
      res = await handler(context);
    } catch (e) {
      console.error('[brambletally] handler error', url.pathname, e);
      return error(500, 'Something went wrong');
    }
    if (!(res instanceof Response)) return error(500, 'Handler returned no response');

    if (slideCookie) {
      res = new Response(res.body, res);
      res.headers.append('Set-Cookie', slideCookie);
    }
    return res;
  },

  // Cron Trigger. wrangler.jsonc schedules "0 15 * * 0" — Sunday 15:00 UTC,
  // roughly 08:00 America/Los_Angeles (drifts one hour across the DST boundary;
  // Cloudflare cron has no timezone support).
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      runWeeklyDigest(env).catch((e) =>
        console.error('[brambletally] weekly digest failed', e)
      )
    );
  },
};
