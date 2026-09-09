/* Brambletally — client app.
 * Auth gate + the project / inbox / weekly-review screens. Rebuilt against the
 * API (not a line-for-line port of noodlr); noodlr's stylesheet supplies the
 * look. Focus-session timer and cross-project search come later. */

'use strict';

const TURNSTILE_SITE_KEY = '0x4AAAAAAEr4nA7ZBjWvB0Ai';
const APP_PATH = '/app';

const STATUSES = ['Active', 'Waiting For', 'Someday', 'Paused', 'Done'];
const STATUS_COLOR = {
  Active: '#2f9491', // turquoise
  'Waiting For': '#bd8a34', // gold
  Someday: '#5566a8', // cobalt-violet
  Paused: '#8a8578', // warm grey
  Done: '#5a8a5f', // settled green
};
const CAT_COLOR = '#3a5fb0'; // cobalt for category chips
const UNCATEGORIZED = 'Uncategorized';

// Stepped "time needed" slider. Index 0 = no estimate; 1..7 map to these
// minute values. Must match STEP_ESTIMATES in worker/api/lib/validate.js.
const STEP_ESTIMATES = [5, 15, 30, 60, 120, 240, 480];
const STEP_ESTIMATE_LABELS = [
  'No estimate', '5 min', '15 min', '30 min', '1 hour', '2 hours', '4 hours', 'A day or more',
];

function fmtDuration(mins) {
  if (!mins || mins <= 0) return '';
  if (mins === 480) return 'day+';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// Sub-step title with its parent prepended: "sew a caftan › cut out pieces".
// Returns the escaped title alone when there's no parent. `parentTitle` may be
// a string or undefined.
function crumb(title, parentTitle) {
  return parentTitle
    ? `<span class="bt-crumb">${esc(parentTitle)} ›</span> ${esc(title)}`
    : esc(title);
}

// Split a project's flat step list into top-level steps and their sub-steps.
// A step with sub-steps is a "container": its checkbox is derived server-side.
function stepTree(steps) {
  const byParent = new Map();
  const top = [];
  for (const s of steps) {
    if (s.parent_step_id) {
      if (!byParent.has(s.parent_step_id)) byParent.set(s.parent_step_id, []);
      byParent.get(s.parent_step_id).push(s);
    } else {
      top.push(s);
    }
  }
  const cmp = (a, b) =>
    (a.sort_order - b.sort_order) || (String(a.created_at) < String(b.created_at) ? -1 : 1);
  top.sort(cmp);
  for (const arr of byParent.values()) arr.sort(cmp);
  return { top, kidsOf: (id) => byParent.get(id) || [] };
}

// Drop container rows from a flat "open steps" list (used by the cross-project
// views, which only get incomplete rows). A row is a container if some other
// row in the same list names it as parent.
function withoutContainers(steps) {
  const parentIds = new Set(steps.filter((s) => s.parent_step_id).map((s) => s.parent_step_id));
  return steps.filter((s) => !parentIds.has(s.id));
}

// ── API ────────────────────────────────────────────────────────────────────
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const API = {
  me: () => api('/api/auth/me'),
  logout: () => api('/api/auth/logout', { method: 'POST' }),
  requestLink: (email, turnstileToken) =>
    api('/api/auth/request-link', { method: 'POST', body: { email, turnstileToken } }),

  listProjects: (opts = {}) => api('/api/projects' + (opts.archived ? '?archived=1' : '')),
  createProject: (b) => api('/api/projects', { method: 'POST', body: b }),
  getProject: (id) => api('/api/projects/' + id),
  updateProject: (id, b) => api('/api/projects/' + id, { method: 'PATCH', body: b }),
  deleteProject: (id) => api('/api/projects/' + id, { method: 'DELETE' }),
  duplicateProject: (id) => api('/api/projects/' + id + '/duplicate', { method: 'POST' }),
  getTasks: () => api('/api/tasks?scope=mine'),

  addStep: (pid, b) => api(`/api/projects/${pid}/steps`, { method: 'POST', body: b }),
  updateStep: (pid, sid, b) =>
    api(`/api/projects/${pid}/steps/${sid}`, { method: 'PATCH', body: b }),
  deleteStep: (pid, sid) => api(`/api/projects/${pid}/steps/${sid}`, { method: 'DELETE' }),
  bashStep: (pid, sid, titles) =>
    api(`/api/projects/${pid}/steps/${sid}/bash`, { method: 'POST', body: { titles } }),

  addSupply: (pid, b) => api(`/api/projects/${pid}/supplies`, { method: 'POST', body: b }),
  updateSupply: (pid, sid, b) =>
    api(`/api/projects/${pid}/supplies/${sid}`, { method: 'PATCH', body: b }),
  deleteSupply: (pid, sid) =>
    api(`/api/projects/${pid}/supplies/${sid}`, { method: 'DELETE' }),

  addLink: (pid, b) => api(`/api/projects/${pid}/links`, { method: 'POST', body: b }),
  updateLink: (pid, lid, b) =>
    api(`/api/projects/${pid}/links/${lid}`, { method: 'PATCH', body: b }),
  deleteLink: (pid, lid) => api(`/api/projects/${pid}/links/${lid}`, { method: 'DELETE' }),

  addJournal: (pid, text) =>
    api(`/api/projects/${pid}/journal`, { method: 'POST', body: { text } }),

  projectSessions: (pid) => api(`/api/projects/${pid}/sessions`),
  addSession: (pid, b) => api(`/api/projects/${pid}/sessions`, { method: 'POST', body: b }),
  updateSession: (pid, sid, b) =>
    api(`/api/projects/${pid}/sessions/${sid}`, { method: 'PATCH', body: b }),
  deleteSession: (pid, sid) =>
    api(`/api/projects/${pid}/sessions/${sid}`, { method: 'DELETE' }),
  mySessions: () => api('/api/sessions'),
  getSession: (sid) => api('/api/sessions/' + encodeURIComponent(sid)),
  getCalendarToken: () => api('/api/settings/calendar-token'),
  regenCalendarToken: () => api('/api/settings/calendar-token', { method: 'POST' }),

  collaborators: (pid) => api(`/api/projects/${pid}/collaborators`),
  addCollaborator: (pid, body) =>
    api(`/api/projects/${pid}/collaborators`, { method: 'POST', body }),
  setCollaboratorRole: (pid, userId, role) =>
    api(`/api/projects/${pid}/collaborators`, { method: 'PATCH', body: { userId, role } }),
  removeCollaborator: (pid, userId) =>
    api(`/api/projects/${pid}/collaborators`, { method: 'DELETE', body: { userId } }),
  transferProject: (pid, toUserId) =>
    api(`/api/projects/${pid}/transfer`, { method: 'POST', body: { toUserId } }),
  searchUsers: (q) => api('/api/users/search?q=' + encodeURIComponent(q)),

  setHandle: (handle) => api('/api/profile/handle', { method: 'PUT', body: { handle } }),
  updateProfile: (body) => api('/api/profile', { method: 'PATCH', body }),
  getProfile: (handle) => api('/api/profile/' + encodeURIComponent(handle)),
  putLinks: (links) => api('/api/profile/links', { method: 'PUT', body: { links } }),
  suggestInterests: (q) => api('/api/interests?q=' + encodeURIComponent(q)),
  putInterests: (labels) => api('/api/interests', { method: 'PUT', body: { labels } }),
  discover: (slug, cursor) =>
    api('/api/interests/' + encodeURIComponent(slug) + (cursor ? '?cursor=' + encodeURIComponent(cursor) : '')),
  notifications: (cursor) =>
    api('/api/notifications' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : '')),
  markNotificationsRead: (ids) =>
    api('/api/notifications/read', { method: 'POST', body: ids ? { ids } : {} }),

  board: (cursor) => api('/api/board' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : '')),
  feed: (filter, cursor) =>
    api(
      '/api/feed?filter=' +
        (filter === 'following' ? 'following' : 'all') +
        (cursor ? '&cursor=' + encodeURIComponent(cursor) : '')
    ),
  listing: (id) => api('/api/board/' + encodeURIComponent(id)),
  createListing: (body) => api('/api/board', { method: 'POST', body }),
  updateListing: (id, body) =>
    api('/api/board/' + encodeURIComponent(id), { method: 'PATCH', body }),
  deleteListing: (id) => api('/api/board/' + encodeURIComponent(id), { method: 'DELETE' }),
  addListingComment: (id, body, parentCommentId) =>
    api(`/api/board/${encodeURIComponent(id)}/comments`, {
      method: 'POST',
      body: { body, parentCommentId },
    }),
  editListingComment: (id, cid, body) =>
    api(`/api/board/${encodeURIComponent(id)}/comments/${cid}`, { method: 'PATCH', body: { body } }),
  deleteListingComment: (id, cid) =>
    api(`/api/board/${encodeURIComponent(id)}/comments/${cid}`, { method: 'DELETE' }),
  requestContribute: (id, message) =>
    api(`/api/board/${encodeURIComponent(id)}/requests`, { method: 'POST', body: { message } }),
  decideRequest: (id, rid, status) =>
    api(`/api/board/${encodeURIComponent(id)}/requests/${rid}`, { method: 'PATCH', body: { status } }),
  withdrawRequest: (id, rid) =>
    api(`/api/board/${encodeURIComponent(id)}/requests/${rid}`, { method: 'DELETE' }),

  listFollowing: () => api('/api/follows'),
  follow: (handle) => api('/api/follows', { method: 'POST', body: { handle } }),
  unfollow: (handle) => api('/api/follows/' + encodeURIComponent(handle), { method: 'DELETE' }),
  followsList: (handle, rel, cursor) =>
    api(
      `/api/profile/${encodeURIComponent(handle)}/${rel}` +
        (cursor ? '?cursor=' + encodeURIComponent(cursor) : '')
    ),
  listBlocks: () => api('/api/blocks'),
  block: (handle) => api('/api/blocks', { method: 'POST', body: { handle } }),
  unblock: (handle) => api('/api/blocks/' + encodeURIComponent(handle), { method: 'DELETE' }),
  adminInterests: (q) => api('/api/admin/interests' + (q ? '?q=' + encodeURIComponent(q) : '')),
  adminRenameInterest: (slug, body) =>
    api('/api/admin/interests/' + encodeURIComponent(slug), { method: 'PATCH', body }),
  adminDeleteInterest: (slug) =>
    api('/api/admin/interests/' + encodeURIComponent(slug), { method: 'DELETE' }),
  adminMergeInterests: (fromSlug, toSlug) =>
    api('/api/admin/interests/merge', { method: 'POST', body: { fromSlug, toSlug } }),
  report: (body) => api('/api/reports', { method: 'POST', body }),
  adminReports: (status, cursor) =>
    api(
      '/api/admin/reports?status=' +
        encodeURIComponent(status || 'open') +
        (cursor ? '&cursor=' + encodeURIComponent(cursor) : '')
    ),
  resolveReport: (id, body) =>
    api('/api/admin/reports/' + encodeURIComponent(id), { method: 'PATCH', body }),
  adminListings: (cursor) =>
    api('/api/admin/listings' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : '')),
  adminUser: (handle) => api('/api/admin/users/' + encodeURIComponent(handle)),
  sanctionUser: (handle, body) =>
    api('/api/admin/users/' + encodeURIComponent(handle) + '/sanction', { method: 'POST', body }),
  saveNotifPrefs: (prefs) => api('/api/settings/notif-prefs', { method: 'PATCH', body: prefs }),
  changeEmail: (email) => api('/api/settings/email', { method: 'POST', body: { email } }),
  acceptTos: () => api('/api/legal/accept', { method: 'POST' }),
  setTimezone: (timezone) => api('/api/settings/timezone', { method: 'PATCH', body: { timezone } }),
  deleteAccount: () => api('/api/account', { method: 'DELETE' }),

  listInbox: () => api('/api/inbox'),
  addInbox: (text) => api('/api/inbox', { method: 'POST', body: { text } }),
  deleteInbox: (id) => api('/api/inbox/' + id, { method: 'DELETE' }),

  review: () => api('/api/review'),
  search: (q) => api('/api/search?q=' + encodeURIComponent(q)),

  listCategories: () => api('/api/categories'),
  createCategory: (name) => api('/api/categories', { method: 'POST', body: { name } }),
  renameCategory: (id, name) => api('/api/categories/' + id, { method: 'PATCH', body: { name } }),
  deleteCategory: (id) => api('/api/categories/' + id, { method: 'DELETE' }),
};

// ── DOM helpers ────────────────────────────────────────────────────────────
const root = () => document.getElementById('bt-app');

function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// ── Icons ───────────────────────────────────────────
// Line set, 24x24, currentColor. icon(name[, size]).
const ICONS = {
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  people: '<circle cx="9" cy="9" r="3.2"/><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M16 7.2A3.2 3.2 0 0 1 19.5 12M15.5 14.4c2.7.2 4.7 2.2 4.7 4.9"/>',
  steps: '<path d="M4 6h16"/><path d="M9 12h11M9 18h11"/><path d="M4.5 12h.01M4.5 18h.01"/>',
  candle: '<path d="M12 3c1.6 1.2 1.6 3 0 4-1.6-1-1.6-2.8 0-4z" fill="currentColor" stroke="none"/><rect x="8.5" y="8" width="7" height="12" rx="1"/><path d="M6 20h12"/>',
  leaf: '<path d="M12 21V7"/><path d="M12 12c-3 0-5-1.6-5.5-4.5C9.4 7 12 8.6 12 12zM12 15c3 0 5-1.6 5.5-4.5C14.6 10 12 11.6 12 15z"/><path d="M12 9c-2.2 0-3.7-1.2-4-3.3M12 9c2.2 0 3.7-1.2 4-3.3"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M14 5l-7 7 7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8L6 18M18 6l1.8-1.8"/>',
  moon: '<path d="M19 13.5A7.5 7.5 0 1 1 10.5 5a6 6 0 0 0 8.5 8.5z"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  link: '<path d="M9.5 13.5a3.5 3.5 0 0 0 5 .3l3-3a3.5 3.5 0 0 0-5-5l-1.2 1.1"/><path d="M14.5 10.5a3.5 3.5 0 0 0-5-.3l-3 3a3.5 3.5 0 0 0 5 5l1.2-1.1"/>',
  settings: '<path d="M4 8h9M17 8h3"/><path d="M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2.3"/><circle cx="9" cy="16" r="2.3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.6 2.5 4 5.7 4 9s-1.4 6.5-4 9c-2.6-2.5-4-5.7-4-9s1.4-6.5 4-9z"/>',
  at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M14 6l4 4"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
};
function icon(name, size = 20) {
  return `<svg class="bt-ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

function on(el, sel, evt, fn) {
  el.querySelectorAll(sel).forEach((n) => n.addEventListener(evt, fn));
}

const parseTs = (s) => new Date(String(s).replace(' ', 'T') + 'Z');

function timeAgo(s) {
  const diff = (Date.now() - parseTs(s).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return parseTs(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Bare hostname for a link with no title — "www." stripped, path dropped.
function linkHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function toast(msg) {
  const t = h(`<div class="bt-toast">${esc(msg)}</div>`);
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 2600);
}

// In-app confirm / prompt (replace the browser dialogs).
function btConfirm(message, { danger = false, ok = 'Confirm' } = {}) {
  return new Promise((resolve) => {
    const overlay = h(`
      <div class="modal-overlay open bt-ask">
        <div class="modal">
          <p class="bt-ask-msg">${esc(message)}</p>
          <div class="bt-ask-actions">
            <button class="btn-sm ${danger ? 'btn-danger' : 'btn-sm-sage'}" data-yes>${esc(ok)}</button>
            <button class="btn-sm btn-sm-ghost" data-no>Cancel</button>
          </div>
        </div>
      </div>
    `);
    const done = (v) => {
      overlay.remove();
      resolve(v);
    };
    on(overlay, '[data-yes]', 'click', () => done(true));
    on(overlay, '[data-no]', 'click', () => done(false));
    overlay.addEventListener('click', (e) => e.target === overlay && done(false));
    document.body.appendChild(overlay);
    overlay.querySelector('[data-yes]').focus();
  });
}

function btPrompt(message, value = '') {
  return new Promise((resolve) => {
    const overlay = h(`
      <div class="modal-overlay open bt-ask">
        <div class="modal">
          <p class="bt-ask-msg">${esc(message)}</p>
          <input class="sp-input" id="bt-ask-in" value="${esc(value)}" />
          <div class="bt-ask-actions">
            <button class="btn-sm btn-sm-sage" data-ok>OK</button>
            <button class="btn-sm btn-sm-ghost" data-no>Cancel</button>
          </div>
        </div>
      </div>
    `);
    const input = overlay.querySelector('#bt-ask-in');
    const done = (v) => {
      overlay.remove();
      resolve(v);
    };
    on(overlay, '[data-ok]', 'click', () => done(input.value.trim() || null));
    on(overlay, '[data-no]', 'click', () => done(null));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') done(input.value.trim() || null);
      if (e.key === 'Escape') done(null);
    });
    overlay.addEventListener('click', (e) => e.target === overlay && done(null));
    document.body.appendChild(overlay);
    input.focus();
    input.select();
  });
}

async function guard(fn) {
  try {
    return await fn();
  } catch (e) {
    if (e.status === 401) {
      state.user = null;
      render();
    } else {
      toast(e.message || 'Something went wrong');
    }
    throw e;
  }
}

// ── Theme ──────────────────────────────────────────────────────────────────
// Two choices: bt-mode (light | dark | system) and bt-palette (bramble | hearth
// | fen). They resolve to data-theme="<palette>-<mode>". The full palette picker
// lands with the Settings Appearance section; the header button just flips
// light/dark for now.
const PALETTES = ['bramble', 'hearth', 'fen'];
function lsGet(k) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function lsSet(k, v) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode */
  }
}
function currentPalette() {
  const p = lsGet('bt-palette');
  return PALETTES.includes(p) ? p : 'bramble';
}
function currentMode() {
  // one-time migration of the old light/dark-only key
  const legacy = lsGet('bt-theme');
  if (legacy === 'light' || legacy === 'dark') {
    lsSet('bt-mode', legacy);
    try {
      localStorage.removeItem('bt-theme');
    } catch {
      /* ignore */
    }
    return legacy;
  }
  const m = lsGet('bt-mode');
  return m === 'light' || m === 'dark' ? m : 'system';
}
function effectiveTheme() {
  const m = currentMode();
  if (m === 'light' || m === 'dark') return m;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applyTheme() {
  document.documentElement.setAttribute('data-theme', currentPalette() + '-' + effectiveTheme());
}
function toggleTheme() {
  lsSet('bt-mode', effectiveTheme() === 'dark' ? 'light' : 'dark');
  applyTheme();
  render();
}
// react to system changes only while the user is on 'system'
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (currentMode() === 'system') applyTheme();
});

// Appearance controls — the Mode segmented control + palette swatches. Lives in
// the Settings screen (renderSettings); live-applies on tap.
const MODES = [
  ['light', 'Light'],
  ['dark', 'Dark'],
  ['system', 'System'],
];
// light-variant swatch colours (bg, accent, accent-2) — a preview chip can't
// read :root[data-theme] tokens, so mirror them here. Source: docs/design.md.
const PALETTE_CARDS = [
  { id: 'bramble', name: 'Bramble', note: 'blackberry & hedgerow', c: ['#f3ecdc', '#6b3457', '#4b6b3a'] },
  { id: 'hearth', name: 'Hearth', note: 'tavern warmth', c: ['#f6eede', '#a8482b', '#8a6a1f'] },
  { id: 'fen', name: 'Fen', note: 'misty marsh', c: ['#e9ece4', '#2f6b6b', '#54763a'] },
];

function appearanceControls() {
  const wrap = h(`
    <div class="bt-appr">
      <div class="bt-appr-label">Mode</div>
      <div class="bt-seg" role="group" aria-label="Mode">
        ${MODES.map(
          ([v, label]) =>
            `<button type="button" data-mode="${v}" class="bt-seg-btn${
              currentMode() === v ? ' is-sel' : ''
            }">${label}</button>`
        ).join('')}
      </div>
      <div class="bt-appr-label">Theme</div>
      <div class="bt-swatches">
        ${PALETTE_CARDS.map(
          (p) => `
          <button type="button" data-palette="${p.id}" class="bt-swatch${
            currentPalette() === p.id ? ' is-sel' : ''
          }" aria-pressed="${currentPalette() === p.id}">
            <span class="bt-swatch-chip" style="background:${p.c[0]}">
              <i style="background:${p.c[1]}"></i><i style="background:${p.c[2]}"></i>
            </span>
            <span class="bt-swatch-name">${p.name}</span>
            <span class="bt-swatch-note">${p.note}</span>
          </button>`
        ).join('')}
      </div>
    </div>
  `);
  on(wrap, '[data-mode]', 'click', (e) => {
    lsSet('bt-mode', e.currentTarget.dataset.mode);
    applyTheme();
    wrap
      .querySelectorAll('[data-mode]')
      .forEach((b) => b.classList.toggle('is-sel', b.dataset.mode === currentMode()));
  });
  on(wrap, '[data-palette]', 'click', (e) => {
    lsSet('bt-palette', e.currentTarget.dataset.palette);
    applyTheme();
    wrap.querySelectorAll('[data-palette]').forEach((b) => {
      const sel = b.dataset.palette === currentPalette();
      b.classList.toggle('is-sel', sel);
      b.setAttribute('aria-pressed', String(sel));
    });
  });
  return wrap;
}

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  user: null,
  me: null, // the full /api/auth/me payload: { user, needs_handle, supporter }
  view: 'home', // home | next | project | inbox | review | settings | search | profile | profile-edit | discover | follows | blocked | admin | board | listing
  viewBeforeProfile: 'home', // where a Back from a profile / discover screen returns
  profileHandle: null, // handle shown by renderProfile
  discoverSlug: null, // interest slug shown by renderDiscover
  projects: [],
  categories: [], // [{id, name, sort_order}]
  filterStatus: 'Active',
  filterCategory: 'all', // 'all' | 'none' | a category name
  homeMode: 'projects', // 'projects' | 'quick' | 'mine'
  quickCap: 30, // minutes ceiling for the Quick tasks list; Infinity = all
  boardMode: 'listings', // 'listings' | 'activity'
  feedFilter: 'all', // 'all' | 'following'
  project: null, // full bundle when view === 'project'
  detailTab: 'steps',
  stepFilterAssignee: 'all', // 'all' | 'me' | a collaborator user_id (project detail, multi-person)
  doneThisSession: 0,
};

async function loadCategories() {
  try {
    state.categories = (await API.listCategories()).categories || [];
  } catch {
    state.categories = [];
  }
}

const EMAIL_RESULT_MSG = {
  changed: 'Your email address has been updated.',
  invalid: 'That email-change link has expired or was already used.',
  taken: 'That address was taken before you confirmed it. Nothing changed.',
};

async function boot() {
  applyTheme();
  try {
    const me = await API.me();
    state.me = me;
    state.user = me.user;
  } catch {
    state.me = null;
    state.user = null;
  }
  render();

  const params = new URLSearchParams(location.search);
  const emailResult = params.get('email');
  if (emailResult && EMAIL_RESULT_MSG[emailResult]) {
    toast(EMAIL_RESULT_MSG[emailResult]);
    params.delete('email');
  }

  // Deep link from a calendar event: open the project and, if it's about now,
  // drop straight into the focus screen preset to that step.
  const focusId = params.get('focus');
  if (focusId) {
    params.delete('focus');
    if (state.user) {
      try {
        const { session } = await API.getSession(focusId);
        await openProject(session.project_id);
        if (state.project && sessionIsSoon(session)) {
          openFocusSession(state.project, {
            stepId: session.step_id,
            planSessionId: session.status === 'planned' ? session.id : null,
          });
        }
      } catch {
        toast('That planned focus time is no longer available.');
      }
    }
  }

  const qs = params.toString();
  if (location.search.slice(1) !== qs) {
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
  }
}

function render() {
  if (!state.user) return renderAuth();
  if (state.user.disabled_at) return renderSuspended();
  // Terms first: the handle-set endpoint (and everything else) is behind the
  // acceptance gate, so a new user must clear this before picking a handle.
  if (state.me && state.me.needs_tos) return renderTos();
  if (state.me && state.me.needs_handle) return renderHandlePrompt();
  renderApp();
}

// ── Handle / suspended screens ─────────────────────────────────────────────
// Mirrors worker/api/lib/handle.js — inline feedback only, the server decides.
function handleReason(raw) {
  const h = String(raw || '').trim().toLowerCase();
  if (h.length < 3) return 'At least 3 characters.';
  if (h.length > 20) return '20 characters or fewer.';
  if (!/^[a-z0-9_]+$/.test(h)) return 'Letters, numbers and underscores only.';
  if (h.startsWith('_') || h.endsWith('_')) return "Can't start or end with an underscore.";
  return null;
}

function renderHandlePrompt() {
  const el = h(`
    <div class="bt-auth">
      <div class="wordmark">brambletally<span>.</span></div>
      <div class="tagline">a keeping-book for makers</div>
      <h1>Pick a handle</h1>
      <p class="sub">This is how other people find you when they share a project. Letters, numbers and underscores, 3&ndash;20 characters. You can change it later.</p>
      <div class="msg err" id="bt-h-err" hidden></div>
      <form id="bt-h-form">
        <label for="bt-h-input">Handle</label>
        <div class="bt-handle-field">
          <span aria-hidden="true">@</span>
          <input id="bt-h-input" autocomplete="off" autocapitalize="off" spellcheck="false"
            inputmode="text" required placeholder="yourname" />
        </div>
        <button type="submit" class="btn-primary" id="bt-h-submit">Continue</button>
      </form>
      <a class="back" id="bt-h-signout" href="#">Sign out</a>
    </div>
  `);
  const input = el.querySelector('#bt-h-input');
  const err = el.querySelector('#bt-h-err');
  const submit = el.querySelector('#bt-h-submit');
  const showErr = (m) => {
    err.textContent = m;
    err.hidden = !m;
  };
  input.addEventListener('input', () => {
    input.value = input.value.replace(/[^A-Za-z0-9_]/g, '').toLowerCase();
    showErr('');
  });
  el.querySelector('#bt-h-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const reason = handleReason(input.value);
    if (reason) return showErr(reason);
    submit.disabled = true;
    submit.textContent = 'Saving…';
    try {
      await API.setHandle(input.value.trim().toLowerCase());
      await boot();
    } catch (ex) {
      showErr(ex.message || 'Could not save that handle.');
      submit.disabled = false;
      submit.textContent = 'Continue';
    }
  });
  el.querySelector('#bt-h-signout').addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await API.logout();
    } catch {
      /* ignore */
    }
    location.href = APP_PATH;
  });
  root().replaceChildren(el);
  input.focus();
}

function renderTos() {
  const returning = !!(state.me && state.me.user && state.me.user.tos_accepted_at);
  const el = h(`
    <div class="bt-auth">
      <div class="wordmark">brambletally<span>.</span></div>
      <div class="tagline">a keeping-book for makers</div>
      <h1>${returning ? 'Updated terms' : 'Before you start'}</h1>
      <p class="sub">${
        returning
          ? 'The Terms and Acceptable Use policy have changed. Have a look and accept them to keep going.'
          : 'Brambletally has a short set of rules — mostly "be decent on the board." Please read and accept them.'
      }</p>
      <div class="msg err" id="bt-tos-err" hidden></div>
      <p class="bt-tos-links">
        <a href="/legal/terms" target="_blank" rel="noopener">Terms of Use</a>
        <span aria-hidden="true">·</span>
        <a href="/legal/acceptable-use" target="_blank" rel="noopener">Acceptable Use</a>
      </p>
      <label class="bt-tos-check">
        <input type="checkbox" id="bt-tos-agree" />
        <span>I've read and agree to the Terms of Use and the Acceptable Use policy.</span>
      </label>
      <button class="btn-primary" id="bt-tos-submit" disabled>Accept and continue</button>
      <a class="back" id="bt-tos-signout" href="#">Sign out</a>
    </div>
  `);
  const agree = el.querySelector('#bt-tos-agree');
  const submit = el.querySelector('#bt-tos-submit');
  const err = el.querySelector('#bt-tos-err');
  agree.addEventListener('change', () => {
    submit.disabled = !agree.checked;
    err.hidden = true;
  });
  submit.addEventListener('click', async () => {
    if (!agree.checked) return;
    submit.disabled = true;
    submit.textContent = 'Saving…';
    try {
      const r = await API.acceptTos();
      if (state.me) {
        state.me.needs_tos = false;
        if (state.me.user) {
          state.me.user.tos_accepted_at = new Date().toISOString();
          state.me.user.tos_version = r.tos_version;
        }
      }
      render();
    } catch (ex) {
      err.textContent = ex.message || 'Could not save that just now.';
      err.hidden = false;
      submit.disabled = false;
      submit.textContent = 'Accept and continue';
    }
  });
  el.querySelector('#bt-tos-signout').addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await API.logout();
    } catch {
      /* ignore */
    }
    location.href = APP_PATH;
  });
  root().replaceChildren(el);
}

function renderSuspended() {
  const el = h(`
    <div class="bt-auth">
      <div class="wordmark">brambletally<span>.</span></div>
      <h1>Account suspended</h1>
      <p class="sub">This account can't be used right now. If you think this is a mistake, reply to your sign-in email.</p>
      <a class="back" id="bt-sus-signout" href="#">Sign out</a>
    </div>
  `);
  el.querySelector('#bt-sus-signout').addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await API.logout();
    } catch {
      /* ignore */
    }
    location.href = APP_PATH;
  });
  root().replaceChildren(el);
}

// ── Settings ──────────────────────────────────────────────────────────────
const NOTIF_TYPE_LABELS = [
  ['follow', 'New follower'],
  ['contributor_request', 'Contributor request on your listing'],
  ['contributor_decided', 'Your request is accepted or declined'],
  ['board_comment', 'Comment on your board listing'],
  ['board_reply', 'Reply to your comment'],
  ['step_assigned', 'A step is assigned to you'],
  ['step_due', 'Reminders for steps due soon'],
];

function renderSettings(app) {
  app.replaceChildren();
  const me = state.me;
  const u = me.user;
  me.notif_prefs = me.notif_prefs || { mode: 'weekly', types: {} };
  me.notif_prefs.types = me.notif_prefs.types || {};
  const prefs = me.notif_prefs;
  const saveNotif = () => guard(() => API.saveNotifPrefs(prefs));

  const el = h(`
    <div class="settings-screen">
      <div class="settings-body">
        <div class="detail-topbar"><button class="detail-back" id="bt-set-back">← Back</button></div>
        <h1 class="detail-title">Settings</h1>

        <div class="sp-section">
          <div class="sp-label">Appearance</div>
          <div id="bt-appr-slot" style="padding:4px 20px 8px"></div>
        </div>

        <div class="sp-section">
          <div class="sp-label">Account</div>
          <div class="sp-row">
            <div class="sp-row-left"><div>Email<div class="sp-row-sub">${esc(u.email)}</div></div></div>
            <button class="btn-sm btn-sm-ghost" id="bt-set-email">Change</button>
          </div>
          <div class="sp-row">
            <div class="sp-row-left"><div>Handle<div class="sp-row-sub">@${esc(u.handle || '')}</div></div></div>
            <button class="btn-sm btn-sm-ghost" id="bt-set-handle">Change</button>
          </div>
          <div class="sp-row">
            <div class="sp-row-left"><div>Profile<div class="sp-row-sub">Bio, pronouns, interests, and links.</div></div></div>
            <button class="btn-sm btn-sm-ghost" id="bt-set-profile">Edit</button>
          </div>
          <div class="sp-row">
            <div class="sp-row-left"><div>Blocked accounts<div class="sp-row-sub">People you’ve blocked.</div></div></div>
            <button class="btn-sm btn-sm-ghost" id="bt-set-blocked">Manage</button>
          </div>
          <div class="sp-field">
            <div class="sp-field-label">Display name</div>
            <div style="display:flex;gap:8px">
              <input class="sp-input" id="bt-set-dname" maxlength="50"
                value="${esc(u.display_name || '')}" placeholder="Optional — shown instead of your handle" />
              <button class="btn-sm btn-sm-sage" id="bt-set-dname-save">Save</button>
            </div>
          </div>
          <div class="sp-field">
            <div class="sp-field-label">Time zone</div>
            <div style="display:flex;gap:8px">
              <select class="sp-select" id="bt-set-tz"></select>
              <button type="button" class="btn-sm btn-sm-ghost" id="bt-set-tz-detect">Detect</button>
            </div>
            <div class="sp-row-sub" style="padding:6px 0 0">Used for due-date reminders and daily summaries. Defaults to US&nbsp;Pacific.</div>
          </div>
        </div>

        <div class="sp-section">
          <div class="sp-label">Notifications</div>
          <div class="sp-field">
            <div class="sp-field-label">How often should we email you?</div>
            <div class="bt-seg" id="bt-notif-mode">
              ${[['immediate', 'Right away'], ['weekly', 'Weekly digest'], ['off', 'Never']]
                .map(
                  ([v, l]) =>
                    `<button type="button" data-nmode="${v}" class="bt-seg-btn${
                      prefs.mode === v ? ' is-sel' : ''
                    }">${l}</button>`
                )
                .join('')}
            </div>
          </div>
          ${NOTIF_TYPE_LABELS.map(
            ([k, l]) => `
            <div class="sp-row">
              <div class="sp-row-left"><div>${l}</div></div>
              <button class="profile-toggle${prefs.types[k] ? ' on' : ''}" data-ntype="${k}"
                role="switch" aria-checked="${!!prefs.types[k]}" aria-label="${l}"></button>
            </div>`
          ).join('')}
          <div class="sp-row-sub" style="padding:8px 20px 0">In-app notifications always show. “Weekly digest” (the default) sends one summary each Sunday; “Right away” emails as things happen; “Never” turns email off. The toggles choose what counts as a notification at all.</div>
        </div>

        <div class="sp-section">
          <div class="sp-label">Your data</div>
          <div class="sp-row">
            <div class="sp-row-left"><div>Export everything<div class="sp-row-sub">Your projects, notes, and account as a JSON file.</div></div></div>
            <button class="btn-sm btn-sm-ghost" id="bt-export">Export</button>
          </div>
          <div class="sp-row">
            <div class="sp-row-left"><div style="color:var(--danger)">Delete account<div class="sp-row-sub">Permanent. Removes your projects and everything in them.</div></div></div>
            <button class="btn-sm btn-danger" id="bt-delete-acct">Delete</button>
          </div>
        </div>

        <div class="sp-section">
          <div class="sp-label">Calendar</div>
          <div class="sp-row-sub" style="padding:0 20px 10px">Subscribe a calendar app to your planned focus time. Add the link in Google Calendar on the web (Other calendars → From URL), or open it on iOS to subscribe.</div>
          <div class="sp-field">
            <div style="display:flex;gap:8px">
              <input class="sp-input" id="bt-cal-url" readonly placeholder="Loading…" style="font-size:13px" />
              <button class="btn-sm btn-sm-sage" id="bt-cal-copy">Copy</button>
            </div>
            <button class="btn-sm btn-sm-ghost" id="bt-cal-regen" style="margin-top:8px">Regenerate link</button>
          </div>
        </div>

        <div class="sp-section">
          <div class="sp-label">Plan</div>
          <div class="sp-row"><div class="sp-row-left"><div>${
            me.supporter ? 'Supporter' : 'Free'
          }<div class="sp-row-sub">${
            me.supporter
              ? 'Thank you for supporting Brambletally.'
              : 'Brambletally is free. A Supporter tier with extra themes and a badge is coming.'
          }</div></div></div></div>
        </div>
        ${
          u.is_admin
            ? `<div class="sp-section">
          <div class="sp-label">Admin</div>
          <div class="sp-row">
            <div class="sp-row-left"><div>Interest tags<div class="sp-row-sub">Rename, merge, or delete tags across all profiles.</div></div></div>
            <button class="btn-sm btn-sm-ghost" id="bt-set-admin">Open</button>
          </div>
        </div>`
            : ''
        }
      </div>
    </div>
  `);

  el.querySelector('#bt-appr-slot').appendChild(appearanceControls());

  on(el, '#bt-set-back', 'click', () => {
    state.view = 'home';
    render();
  });
  on(el, '#bt-set-handle', 'click', openHandleChange);
  on(el, '#bt-set-email', 'click', async () => {
    const next = await btPrompt('New email address', '');
    if (!next) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(next)) {
      toast('Enter a valid email address');
      return;
    }
    try {
      await API.changeEmail(next);
      toast(`Check ${next} for a link to confirm the change.`);
    } catch (ex) {
      toast(ex.message || 'Could not start the email change');
    }
  });
  on(el, '#bt-set-profile', 'click', () => {
    state.viewBeforeProfile = 'settings';
    state.view = 'profile-edit';
    render();
  });
  on(el, '#bt-set-blocked', 'click', () => {
    state.view = 'blocked';
    render();
  });
  on(el, '#bt-set-admin', 'click', () => {
    state.view = 'admin';
    render();
  });
  on(el, '#bt-set-dname-save', 'click', async () => {
    const v = el.querySelector('#bt-set-dname').value.trim();
    await guard(() => API.updateProfile({ display_name: v || null }));
    state.me.user.display_name = v || null;
    toast('Display name saved');
  });

  // Time zone — a native <select> of IANA zones, plus a Detect button.
  const tzSel = el.querySelector('#bt-set-tz');
  const tzList =
    typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  const cur = u.timezone || '';
  tzSel.innerHTML =
    '<option value="">Default (US Pacific)</option>' +
    (cur && !tzList.includes(cur) ? `<option value="${esc(cur)}" selected>${esc(cur)}</option>` : '') +
    tzList
      .map(
        (z) =>
          `<option value="${esc(z)}"${z === cur ? ' selected' : ''}>${esc(z.replace(/_/g, ' '))}</option>`
      )
      .join('');
  on(el, '#bt-set-tz', 'change', async () => {
    const v = tzSel.value || null;
    try {
      await guard(() => API.setTimezone(v));
      state.me.user.timezone = v;
      toast('Time zone saved');
    } catch {
      /* toast already shown */
    }
  });
  on(el, '#bt-set-tz-detect', 'click', () => {
    let z;
    try {
      z = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      z = null;
    }
    if (!z) return toast("Couldn't detect your time zone");
    if (![...tzSel.options].some((o) => o.value === z)) {
      tzSel.add(new Option(z.replace(/_/g, ' '), z));
    }
    if (tzSel.value === z) return toast(`Already set to ${z.replace(/_/g, ' ')}`);
    tzSel.value = z;
    tzSel.dispatchEvent(new Event('change'));
  });
  on(el, '#bt-notif-mode [data-nmode]', 'click', (e) => {
    prefs.mode = e.currentTarget.dataset.nmode;
    el.querySelectorAll('#bt-notif-mode [data-nmode]').forEach((b) =>
      b.classList.toggle('is-sel', b.dataset.nmode === prefs.mode)
    );
    saveNotif();
  });
  on(el, '[data-ntype]', 'click', (e) => {
    const k = e.currentTarget.dataset.ntype;
    const next = !e.currentTarget.classList.contains('on');
    e.currentTarget.classList.toggle('on', next);
    e.currentTarget.setAttribute('aria-checked', String(next));
    prefs.types[k] = next;
    saveNotif();
  });
  const calUrl = el.querySelector('#bt-cal-url');
  API.getCalendarToken()
    .then((r) => {
      calUrl.value = r.url;
    })
    .catch(() => {
      calUrl.placeholder = 'Could not load the calendar link.';
    });
  on(el, '#bt-cal-copy', 'click', async () => {
    if (!calUrl.value) return;
    try {
      await navigator.clipboard.writeText(calUrl.value);
      toast('Calendar link copied');
    } catch {
      calUrl.select();
      toast('Select and copy the link');
    }
  });
  on(el, '#bt-cal-regen', 'click', async () => {
    const ok = await btConfirm(
      'Regenerate the calendar link? Any calendar already subscribed to the old link stops updating.',
      { ok: 'Regenerate' }
    );
    if (!ok) return;
    try {
      const r = await API.regenCalendarToken();
      calUrl.value = r.url;
      toast('New calendar link ready');
    } catch (ex) {
      toast(ex.message || 'Could not regenerate the link');
    }
  });
  on(el, '#bt-export', 'click', async () => {
    try {
      const res = await fetch('/api/settings/export', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Export failed');
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = 'brambletally-export.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (ex) {
      toast(ex.message || 'Export failed');
    }
  });
  on(el, '#bt-delete-acct', 'click', async () => {
    const ok = await btConfirm(
      'Delete your account? This removes your projects and everything in them. It cannot be undone.',
      { danger: true, ok: 'Delete account' }
    );
    if (!ok) return;
    try {
      await API.deleteAccount();
      location.href = APP_PATH;
    } catch (ex) {
      toast(ex.message);
    }
  });

  app.appendChild(el);
}

function openHandleChange() {
  const overlay = h(`
    <div class="modal-overlay open bt-ask">
      <div class="modal">
        <div class="modal-header"><span class="modal-title">Change handle</span>
          <button class="modal-close" aria-label="Close">${icon('close')}</button></div>
        <div class="msg err" id="bt-hc-err" hidden></div>
        <form id="bt-hc-form">
          <label class="sp-label" style="padding-left:0">New handle</label>
          <div class="bt-handle-field"><span aria-hidden="true">@</span>
            <input id="bt-hc-input" class="sp-input" autocomplete="off" autocapitalize="off"
              spellcheck="false" value="${esc(state.me.user.handle || '')}" />
          </div>
          <p class="sp-row-sub" style="margin:0 0 14px">Letters, numbers and underscores, 3&ndash;20 characters. You can change it again after 30 days.</p>
          <div style="display:flex;gap:8px">
            <button type="submit" class="btn-sm btn-sm-sage">Save</button>
            <button type="button" class="btn-sm btn-sm-ghost" data-cancel>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `);
  const close = () => overlay.remove();
  const err = overlay.querySelector('#bt-hc-err');
  const input = overlay.querySelector('#bt-hc-input');
  input.addEventListener('input', () => {
    input.value = input.value.replace(/[^A-Za-z0-9_]/g, '').toLowerCase();
    err.hidden = true;
  });
  on(overlay, '.modal-close, [data-cancel]', 'click', close);
  overlay.addEventListener('click', (e) => e.target === overlay && close());
  on(overlay, '#bt-hc-form', 'submit', async (e) => {
    e.preventDefault();
    const reason = handleReason(input.value);
    if (reason) {
      err.textContent = reason;
      err.hidden = false;
      return;
    }
    try {
      const r = await API.setHandle(input.value.trim().toLowerCase());
      state.me.user.handle = r.handle;
      close();
      render();
      toast('Handle changed');
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    }
  });
  document.body.appendChild(overlay);
  input.focus();
}

// ── Profile ───────────────────────────────────────────────────────────────
// platform -> [value, label, icon]. Mirrors LINK_PLATFORMS in
// worker/api/lib/profile.js; the server folds anything unknown to 'other'.
const LINK_PLATFORMS = [
  ['website', 'Website', 'globe'],
  ['instagram', 'Instagram', 'link'],
  ['bluesky', 'Bluesky', 'at'],
  ['mastodon', 'Mastodon', 'at'],
  ['github', 'GitHub', 'link'],
  ['etsy', 'Etsy', 'link'],
  ['ravelry', 'Ravelry', 'link'],
  ['youtube', 'YouTube', 'link'],
  ['other', 'Other', 'link'],
];
const MAX_LINKS = 8;
const MAX_INTERESTS = 15;
const MAX_INTEREST_LABEL = 30;

const platformMeta = (p) => LINK_PLATFORMS.find((x) => x[0] === p) || ['other', 'Link', 'link'];

// Client-side mirror of the server slugify — used only for the local cap /
// dedupe while editing. The server re-slugs authoritatively on save.
function slugifyInterest(label) {
  return String(label || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
const avatarEl = (nameForInitials, extra = '') =>
  `<span class="bt-avatar ${extra}">${esc(initials(nameForInitials))}</span>`;

// Resolve a user id to a display name from a project bundle's collaborator list.
function collabName(b, userId) {
  const c = (b.collaborators || []).find((x) => x.user_id === userId);
  if (!c) return null;
  return c.name || (c.email ? c.email.split('@')[0] : '@?');
}

// A small floating menu of the project's collaborators, anchored under `anchor`.
// Picking one assigns the step; "Unassign" clears it.
function openAssigneeMenu(anchor, b, s, rerender) {
  document.querySelector('.bt-assignee-menu')?.remove();
  const menu = h('<div class="bt-assignee-menu"></div>');
  const pick = async (uid) => {
    menu.remove();
    document.removeEventListener('click', onDoc, true);
    try {
      await guard(() => API.updateStep(b.project.id, s.id, { assignee_id: uid }));
    } catch {
      return;
    }
    rerender();
  };
  (b.collaborators || []).forEach((c) => {
    const name = c.name || (c.email ? c.email.split('@')[0] : '@?');
    const item = h(
      `<button class="bt-assignee-item${s.assignee_id === c.user_id ? ' is-sel' : ''}">${avatarEl(
        name
      )}<span>${esc(name)}</span></button>`
    );
    item.addEventListener('click', () => pick(c.user_id));
    menu.appendChild(item);
  });
  if (s.assignee_id) {
    const un = h('<button class="bt-assignee-item bt-assignee-clear">Unassign</button>');
    un.addEventListener('click', () => pick(null));
    menu.appendChild(un);
  }
  const r = anchor.getBoundingClientRect();
  menu.style.top = window.scrollY + r.bottom + 4 + 'px';
  menu.style.left = Math.max(8, window.scrollX + r.right - 190) + 'px';
  document.body.appendChild(menu);
  const onDoc = (e) => {
    if (!menu.contains(e.target) && e.target !== anchor) {
      menu.remove();
      document.removeEventListener('click', onDoc, true);
    }
  };
  setTimeout(() => document.addEventListener('click', onDoc, true), 0);
}

function openProfile(handle) {
  if (!handle) return;
  if (!['profile', 'profile-edit', 'discover'].includes(state.view))
    state.viewBeforeProfile = state.view;
  state.view = 'profile';
  state.profileHandle = handle;
  state.project = null;
  render();
}
function openDiscover(slug) {
  if (!['profile', 'discover'].includes(state.view)) state.viewBeforeProfile = state.view;
  state.view = 'discover';
  state.discoverSlug = slug;
  render();
}
function openFollowList(handle, rel) {
  if (!['profile', 'follows', 'discover'].includes(state.view))
    state.viewBeforeProfile = state.view;
  state.view = 'follows';
  state.followListHandle = handle;
  state.followListRel = rel; // 'followers' | 'following'
  render();
}

const myHandle = () => (state.me && state.me.user && state.me.user.handle) || null;

// A self-managing Follow / Following toggle button.
function followToggleBtn(handle, following) {
  const btn = h(
    `<button class="btn-sm bt-follow-btn${
      following ? ' is-following' : ''
    }">${following ? 'Following' : 'Follow'}</button>`
  );
  let busy = false;
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (busy) return;
    busy = true;
    const next = !btn.classList.contains('is-following');
    try {
      await (next ? API.follow(handle) : API.unfollow(handle));
    } catch (ex) {
      toast(ex.message || 'Could not update follow');
      busy = false;
      return;
    }
    btn.classList.toggle('is-following', next);
    btn.textContent = next ? 'Following' : 'Follow';
    btn.dispatchEvent(new CustomEvent('followchange', { detail: { following: next }, bubbles: true }));
    busy = false;
  });
  return btn;
}

// Tappable person row — discovery, People search, follower/following lists.
// opts.follow adds a Follow toggle (skipped for the caller's own row).
function personRow(u, opts = {}) {
  const name = u.display_name || u.name || '@' + u.handle;
  const tap = h(`
    <button class="bt-person">
      ${avatarEl(u.display_name || u.name || u.handle)}
      <span class="bt-person-main">
        <span class="bt-person-name">${esc(name)}${
          u.supporter ? ' <span class="bt-supporter">Supporter</span>' : ''
        }</span>
        <span class="bt-person-sub">@${esc(u.handle)}</span>
      </span>
    </button>
  `);
  tap.addEventListener('click', () => openProfile(u.handle));
  if (opts.follow && u.handle !== myHandle()) {
    const wrap = h('<div class="bt-person-wrap"></div>');
    wrap.append(tap, followToggleBtn(u.handle, !!u.is_following));
    return wrap;
  }
  return tap;
}

async function renderProfile(app) {
  app.replaceChildren();
  const back = state.viewBeforeProfile || 'home';
  const el = h(`
    <div class="settings-screen">
      <div class="settings-body">
        <div class="detail-topbar"><button class="detail-back" id="bt-prof-back">← Back</button></div>
        <div id="bt-prof-body"><div class="empty">Loading…</div></div>
      </div>
    </div>
  `);
  on(el, '#bt-prof-back', 'click', () => {
    state.view = back;
    render();
  });
  app.appendChild(el);

  let data;
  try {
    data = await guard(() => API.getProfile(state.profileHandle));
  } catch {
    el.querySelector('#bt-prof-body').replaceChildren(
      h('<div class="empty">Profile not found.</div>')
    );
    return;
  }
  const p = data.profile;
  const name = p.display_name || '@' + p.handle;
  const body = el.querySelector('#bt-prof-body');
  body.replaceChildren();

  body.appendChild(
    h(`
    <div class="bt-prof-head">
      ${avatarEl(p.display_name || p.name || p.handle, 'bt-avatar-lg')}
      <div class="bt-prof-id">
        <h1 class="detail-title">${esc(name)}</h1>
        <div class="bt-prof-handle">@${esc(p.handle)}${
          p.supporter ? ' <span class="bt-supporter">Supporter</span>' : ''
        }${p.is_admin ? ' <span class="bt-admin-tag">Admin</span>' : ''}${
          p.follows_you && !p.is_self ? ' <span class="bt-follows-you">Follows you</span>' : ''
        }</div>
        ${p.pronouns ? `<div class="bt-prof-pronouns">${esc(p.pronouns)}</div>` : ''}
      </div>
    </div>
  `)
  );

  const counts = h(`
    <div class="bt-prof-counts">
      <button data-rel="followers"><b>${p.follower_count || 0}</b> ${
        (p.follower_count || 0) === 1 ? 'follower' : 'followers'
      }</button>
      <button data-rel="following"><b>${p.following_count || 0}</b> following</button>
    </div>
  `);
  on(counts, '[data-rel]', 'click', (e) =>
    openFollowList(p.handle, e.currentTarget.dataset.rel)
  );
  body.appendChild(counts);

  const actions = h('<div class="bt-prof-actions"></div>');
  if (p.is_self) {
    const editBtn = h(
      `<button class="btn-sm btn-sm-ghost" id="bt-prof-edit">${icon('edit', 16)} Edit profile</button>`
    );
    editBtn.addEventListener('click', () => {
      state.view = 'profile-edit';
      render();
    });
    actions.appendChild(editBtn);
  } else {
    const followBtn = followToggleBtn(p.handle, p.is_following);
    followBtn.addEventListener('followchange', (e) => {
      const n = counts.querySelector('[data-rel="followers"] b');
      n.textContent = String(
        Math.max(0, parseInt(n.textContent, 10) + (e.detail.following ? 1 : -1))
      );
    });
    actions.appendChild(followBtn);

    const blockBtn = h(`<button class="btn-sm btn-sm-ghost bt-prof-block">Block</button>`);
    blockBtn.addEventListener('click', async () => {
      const ok = await btConfirm(
        `Block @${p.handle}? You won't see each other in search, discovery, or profiles, and any follow between you is removed. You can undo this in Settings.`,
        { danger: true, ok: 'Block' }
      );
      if (!ok) return;
      try {
        await API.block(p.handle);
      } catch (ex) {
        toast(ex.message || 'Could not block');
        return;
      }
      toast(`Blocked @${p.handle}`);
      state.view = back;
      render();
    });
    actions.appendChild(blockBtn);

    const repBtn = h('<button class="btn-sm btn-sm-ghost">Report</button>');
    repBtn.addEventListener('click', () => openReportModal('profile', p.handle));
    actions.appendChild(repBtn);
  }
  body.appendChild(actions);

  if (p.bio) {
    const sec = h(
      '<div class="sp-section"><div class="sp-label">About</div><div class="bt-prof-bio"></div></div>'
    );
    sec.querySelector('.bt-prof-bio').textContent = p.bio;
    body.appendChild(sec);
  }

  if (p.interests && p.interests.length) {
    const sec = h(
      '<div class="sp-section"><div class="sp-label">Interests</div><div class="bt-chips"></div></div>'
    );
    const chips = sec.querySelector('.bt-chips');
    p.interests.forEach((t) => {
      const c = h(`<button class="bt-chip">${esc(t.label)}</button>`);
      c.addEventListener('click', () => openDiscover(t.slug));
      chips.appendChild(c);
    });
    body.appendChild(sec);
  }

  if (p.links && p.links.length) {
    const sec = h(
      '<div class="sp-section"><div class="sp-label">Links</div><div class="bt-prof-links"></div></div>'
    );
    const wrap = sec.querySelector('.bt-prof-links');
    p.links.forEach((l) => {
      const [, label, ic] = platformMeta(l.platform);
      const text = l.platform === 'other' || l.platform === 'website' ? linkHost(l.value) : label;
      wrap.appendChild(
        h(`
        <a class="bt-prof-link" href="${esc(l.value)}" target="_blank" rel="me nofollow noopener">
          ${icon(ic, 18)}<span>${esc(text)}</span>
        </a>
      `)
      );
    });
    body.appendChild(sec);
  }

  if (!p.bio && !(p.interests || []).length && !(p.links || []).length) {
    body.appendChild(
      h(
        `<div class="empty">${
          p.is_self ? 'Your profile is empty. Add a bio, interests, or links.' : 'Nothing here yet.'
        }</div>`
      )
    );
  }
}

async function renderProfileEdit(app) {
  app.replaceChildren();
  const myHandle = state.me.user.handle;
  const el = h(`
    <div class="settings-screen">
      <div class="settings-body">
        <div class="detail-topbar"><button class="detail-back" id="bt-pe-back">← Back</button></div>
        <h1 class="detail-title">Edit profile</h1>
        <div id="bt-pe-body"><div class="empty">Loading…</div></div>
      </div>
    </div>
  `);
  on(el, '#bt-pe-back', 'click', () => openProfile(myHandle));
  app.appendChild(el);

  let data;
  try {
    data = await guard(() => API.getProfile(myHandle));
  } catch {
    el.querySelector('#bt-pe-body').replaceChildren(
      h('<div class="empty">Could not load your profile.</div>')
    );
    return;
  }
  const p = data.profile;
  const bodyEl = el.querySelector('#bt-pe-body');
  bodyEl.replaceChildren();

  const form = h(`
    <div>
      <div class="sp-field">
        <div class="sp-field-label">Display name</div>
        <input class="sp-input" id="bt-pe-dname" maxlength="50" value="${esc(p.display_name || '')}"
          placeholder="Shown instead of your handle" />
      </div>
      <div class="sp-field">
        <div class="sp-field-label">Pronouns</div>
        <input class="sp-input" id="bt-pe-pronouns" maxlength="40" value="${esc(p.pronouns || '')}"
          placeholder="e.g. she/her" />
      </div>
      <div class="sp-field">
        <div class="sp-field-label">About <span class="bt-count" id="bt-pe-biocount"></span></div>
        <textarea class="sp-input bt-textarea" id="bt-pe-bio" maxlength="500" rows="4"
          placeholder="A few lines about you and what you make.">${esc(p.bio || '')}</textarea>
      </div>
      <div class="sp-field">
        <div class="sp-field-label">Interests</div>
        <div id="bt-pe-interests"></div>
      </div>
      <div class="sp-field">
        <div class="sp-field-label">Links</div>
        <div id="bt-pe-links"></div>
      </div>
      <div class="bt-pe-actions">
        <button class="btn-sm btn-sm-sage" id="bt-pe-save">Save</button>
        <button class="btn-sm btn-sm-ghost" id="bt-pe-cancel">Cancel</button>
      </div>
    </div>
  `);
  bodyEl.appendChild(form);

  const bio = form.querySelector('#bt-pe-bio');
  const bioCount = form.querySelector('#bt-pe-biocount');
  const updCount = () => (bioCount.textContent = `${bio.value.length}/500`);
  bio.addEventListener('input', updCount);
  updCount();

  const interests = interestEditor(p.interests || []);
  form.querySelector('#bt-pe-interests').appendChild(interests.el);
  const links = linksEditor(p.links || []);
  form.querySelector('#bt-pe-links').appendChild(links.el);

  on(form, '#bt-pe-cancel', 'click', () => openProfile(myHandle));
  on(form, '#bt-pe-save', 'click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const dn = form.querySelector('#bt-pe-dname').value.trim();
      await guard(() =>
        API.updateProfile({
          display_name: dn || null,
          bio: bio.value.trim() || null,
          pronouns: form.querySelector('#bt-pe-pronouns').value.trim() || null,
        })
      );
      await guard(() => API.putInterests(interests.values()));
      await guard(() => API.putLinks(links.values()));
      state.me.user.display_name = dn || null;
      toast('Profile saved');
      openProfile(myHandle);
    } catch {
      btn.disabled = false;
    }
  });
}

// Removable-chip interest editor with server-backed autocomplete.
// Returns { el, values() -> [label] }.
function interestEditor(initial) {
  const values = (initial || []).map((t) => t.label);
  const el = h(`
    <div class="bt-tag-editor">
      <div class="bt-chips" id="bt-tag-chips"></div>
      <div class="bt-tag-inputwrap">
        <input class="sp-input" id="bt-tag-input" maxlength="${MAX_INTEREST_LABEL}" autocomplete="off"
          placeholder="Add an interest, press Enter" />
        <div class="bt-tag-suggest" id="bt-tag-suggest" hidden></div>
      </div>
      <div class="sp-row-sub" id="bt-tag-hint"></div>
    </div>
  `);
  const chipsEl = el.querySelector('#bt-tag-chips');
  const input = el.querySelector('#bt-tag-input');
  const suggest = el.querySelector('#bt-tag-suggest');
  const hint = el.querySelector('#bt-tag-hint');

  const hideSuggest = () => {
    suggest.hidden = true;
    suggest.replaceChildren();
  };
  const renderChips = () => {
    chipsEl.replaceChildren();
    values.forEach((label, i) => {
      const c = h(
        `<span class="bt-chip bt-chip-rm">${esc(label)}<button aria-label="Remove">${icon(
          'close',
          14
        )}</button></span>`
      );
      c.querySelector('button').addEventListener('click', () => {
        values.splice(i, 1);
        renderChips();
      });
      chipsEl.appendChild(c);
    });
    hint.textContent = `${values.length}/${MAX_INTERESTS}`;
    input.disabled = values.length >= MAX_INTERESTS;
  };
  const add = (label) => {
    const clean = String(label || '').trim().slice(0, MAX_INTEREST_LABEL);
    const slug = slugifyInterest(clean);
    input.value = '';
    hideSuggest();
    if (!clean || !slug || values.length >= MAX_INTERESTS) return;
    if (values.some((v) => slugifyInterest(v) === slug)) return;
    values.push(clean);
    renderChips();
  };

  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 1) return hideSuggest();
    timer = setTimeout(async () => {
      let r;
      try {
        r = await API.suggestInterests(q);
      } catch {
        return;
      }
      const tags = (r.tags || []).filter(
        (t) => !values.some((v) => slugifyInterest(v) === t.slug)
      );
      if (!tags.length) return hideSuggest();
      suggest.replaceChildren();
      tags.forEach((t) => {
        const b = h(
          `<button class="bt-tag-suggest-item">${esc(t.label)} <span>${t.usage_count}</span></button>`
        );
        b.addEventListener('click', () => {
          add(t.label);
          input.focus();
        });
        suggest.appendChild(b);
      });
      suggest.hidden = false;
    }, 200);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      add(input.value);
    } else if (e.key === 'Backspace' && !input.value && values.length) {
      values.pop();
      renderChips();
    }
  });
  input.addEventListener('blur', () => setTimeout(hideSuggest, 150));

  renderChips();
  return { el, values: () => values.slice() };
}

// Platform-select + URL rows. Returns { el, values() -> [{platform, value}] }.
function linksEditor(initial) {
  const rows = (initial || []).map((l) => ({
    platform: l.platform || 'website',
    value: l.value || '',
  }));
  if (!rows.length) rows.push({ platform: 'website', value: '' });
  const el = h('<div class="bt-links-editor"></div>');
  const list = h('<div></div>');
  const addBtn = h(
    `<button class="btn-sm btn-sm-ghost bt-links-add" id="bt-links-add">${icon('plus', 14)} Add link</button>`
  );
  el.append(list, addBtn);

  const renderRows = () => {
    list.replaceChildren();
    rows.forEach((r, i) => {
      const row = h(`
        <div class="bt-link-row">
          <select class="sp-input bt-link-platform">
            ${LINK_PLATFORMS.map(
              ([v, label]) =>
                `<option value="${v}"${r.platform === v ? ' selected' : ''}>${label}</option>`
            ).join('')}
          </select>
          <input class="sp-input bt-link-url" type="url" inputmode="url" placeholder="https://…"
            value="${esc(r.value)}" />
          <button class="bt-link-rm" aria-label="Remove link">${icon('close', 16)}</button>
        </div>
      `);
      row.querySelector('.bt-link-platform').addEventListener('change', (e) => {
        r.platform = e.target.value;
      });
      row.querySelector('.bt-link-url').addEventListener('input', (e) => {
        r.value = e.target.value;
      });
      row.querySelector('.bt-link-rm').addEventListener('click', () => {
        rows.splice(i, 1);
        if (!rows.length) rows.push({ platform: 'website', value: '' });
        renderRows();
      });
      list.appendChild(row);
    });
    addBtn.disabled = rows.length >= MAX_LINKS;
  };
  addBtn.addEventListener('click', () => {
    if (rows.length >= MAX_LINKS) return;
    rows.push({ platform: 'website', value: '' });
    renderRows();
  });

  renderRows();
  return {
    el,
    values: () =>
      rows.map((r) => ({ platform: r.platform, value: r.value.trim() })).filter((r) => r.value),
  };
}

async function renderDiscover(app) {
  app.replaceChildren();
  const back = state.viewBeforeProfile || 'home';
  const el = h(`
    <div class="settings-screen">
      <div class="settings-body">
        <div class="detail-topbar"><button class="detail-back" id="bt-disc-back">← Back</button></div>
        <div id="bt-disc-body"><div class="empty">Loading…</div></div>
      </div>
    </div>
  `);
  on(el, '#bt-disc-back', 'click', () => {
    state.view = back;
    render();
  });
  app.appendChild(el);

  const body = el.querySelector('#bt-disc-body');
  let cursor = null;
  let first = true;
  let listWrap;

  const loadMore = async (moreBtn) => {
    let r;
    try {
      r = await guard(() => API.discover(state.discoverSlug, cursor));
    } catch {
      if (first) body.replaceChildren(h('<div class="empty">Interest not found.</div>'));
      return;
    }
    if (first) {
      body.replaceChildren();
      body.appendChild(h(`<h1 class="detail-title">${esc(r.tag.label)}</h1>`));
      body.appendChild(
        h(
          `<div class="sp-row-sub" style="padding:0 0 10px">${r.tag.usage_count} ${
            r.tag.usage_count === 1 ? 'person' : 'people'
          }</div>`
        )
      );
      listWrap = h('<div class="bt-person-list"></div>');
      body.appendChild(listWrap);
      first = false;
    }
    if (moreBtn) moreBtn.remove();
    (r.users || []).forEach((u) => listWrap.appendChild(personRow(u)));
    if (!listWrap.children.length) {
      listWrap.appendChild(h('<div class="empty">No one else yet.</div>'));
    }
    cursor = r.next_cursor;
    if (cursor) {
      const b = h('<button class="btn-sm btn-sm-ghost bt-loadmore">Load more</button>');
      b.addEventListener('click', () => loadMore(b));
      body.appendChild(b);
    }
  };

  loadMore(null);
}

// ── Follower / following list ────────────────────────────────────────────
async function renderFollowList(app) {
  app.replaceChildren();
  const handle = state.followListHandle;
  const rel = state.followListRel === 'followers' ? 'followers' : 'following';
  const el = h(`
    <div class="settings-screen">
      <div class="settings-body">
        <div class="detail-topbar"><button class="detail-back" id="bt-fl-back">← Back</button></div>
        <div id="bt-fl-body"><div class="empty">Loading…</div></div>
      </div>
    </div>
  `);
  on(el, '#bt-fl-back', 'click', () => openProfile(handle));
  app.appendChild(el);

  const body = el.querySelector('#bt-fl-body');
  let cursor = null;
  let first = true;
  let listWrap;

  const loadMore = async (moreBtn) => {
    let r;
    try {
      r = await guard(() => API.followsList(handle, rel, cursor));
    } catch {
      if (first) body.replaceChildren(h('<div class="empty">Not found.</div>'));
      return;
    }
    if (first) {
      body.replaceChildren();
      body.appendChild(
        h(
          `<h1 class="detail-title">${rel === 'followers' ? 'Followers' : 'Following'}</h1>`
        )
      );
      body.appendChild(
        h(
          `<div class="sp-row-sub" style="padding:0 0 10px">@${esc(
            (r.profile && r.profile.handle) || handle
          )}</div>`
        )
      );
      listWrap = h('<div class="bt-person-list"></div>');
      body.appendChild(listWrap);
      first = false;
    }
    if (moreBtn) moreBtn.remove();
    (r.users || []).forEach((u) => listWrap.appendChild(personRow(u, { follow: true })));
    if (!listWrap.children.length) {
      listWrap.appendChild(
        h(
          `<div class="empty">${
            rel === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'
          }</div>`
        )
      );
    }
    cursor = r.next_cursor;
    if (cursor) {
      const b = h('<button class="btn-sm btn-sm-ghost bt-loadmore">Load more</button>');
      b.addEventListener('click', () => loadMore(b));
      body.appendChild(b);
    }
  };

  loadMore(null);
}

// ── Blocked accounts (Settings) ──────────────────────────────────────────
async function renderBlocked(app) {
  app.replaceChildren();
  const el = h(`
    <div class="settings-screen">
      <div class="settings-body">
        <div class="detail-topbar"><button class="detail-back" id="bt-bl-back">← Back</button></div>
        <h1 class="detail-title">Blocked accounts</h1>
        <div id="bt-bl-body"><div class="empty">Loading…</div></div>
      </div>
    </div>
  `);
  on(el, '#bt-bl-back', 'click', () => {
    state.view = 'settings';
    render();
  });
  app.appendChild(el);

  const body = el.querySelector('#bt-bl-body');
  let data;
  try {
    data = await guard(() => API.listBlocks());
  } catch {
    body.replaceChildren(h('<div class="empty">Could not load your block list.</div>'));
    return;
  }
  const fill = (blocks) => {
    body.replaceChildren();
    if (!blocks.length) {
      body.appendChild(h('<div class="empty">You haven’t blocked anyone.</div>'));
      return;
    }
    blocks.forEach((u) => {
      const row = h(`
        <div class="sp-row">
          <div class="sp-row-left">
            ${avatarEl(u.display_name || u.name || u.handle)}
            <div>${esc(u.display_name || u.name || '@' + u.handle)}<div class="sp-row-sub">@${esc(
              u.handle
            )}</div></div>
          </div>
          <button class="btn-sm btn-sm-ghost" data-unblock>Unblock</button>
        </div>
      `);
      row.querySelector('[data-unblock]').addEventListener('click', async (e) => {
        e.currentTarget.disabled = true;
        try {
          await API.unblock(u.handle);
        } catch (ex) {
          toast(ex.message || 'Could not unblock');
          e.currentTarget.disabled = false;
          return;
        }
        data.blocks = data.blocks.filter((b) => b.handle !== u.handle);
        fill(data.blocks);
        toast(`Unblocked @${u.handle}`);
      });
      body.appendChild(row);
    });
  };
  fill(data.blocks || []);
}

// ── Admin panel ─────────────────────────────────────────────────────────
const ADMIN_TABS = [
  ['reports', 'Reports'],
  ['users', 'Users'],
  ['listings', 'Listings'],
  ['tags', 'Tags'],
];

async function renderAdmin(app) {
  app.replaceChildren();
  if (!(state.me && state.me.user && state.me.user.is_admin)) {
    state.view = 'settings';
    render();
    return;
  }
  if (!ADMIN_TABS.some(([t]) => t === state.adminTab)) state.adminTab = 'reports';
  const el = h(`
    <div class="settings-screen">
      <div class="settings-body">
        <div class="detail-topbar"><button class="detail-back" id="bt-adm-back">← Back</button></div>
        <h1 class="detail-title">Admin</h1>
        <div class="bt-seg" id="bt-adm-tabs" style="margin:4px 20px 12px">
          ${ADMIN_TABS.map(
            ([t, l]) =>
              `<button type="button" data-atab="${t}" class="bt-seg-btn${
                state.adminTab === t ? ' is-sel' : ''
              }">${l}</button>`
          ).join('')}
        </div>
        <div id="bt-adm-panel"><div class="empty">Loading…</div></div>
      </div>
    </div>
  `);
  on(el, '#bt-adm-back', 'click', () => {
    state.view = 'settings';
    render();
  });
  on(el, '#bt-adm-tabs [data-atab]', 'click', (e) => {
    state.adminTab = e.currentTarget.dataset.atab;
    render();
  });
  app.appendChild(el);

  const host = el.querySelector('#bt-adm-panel');
  if (state.adminTab === 'reports') adminReportsSection(host);
  else if (state.adminTab === 'users') adminUsersSection(host);
  else if (state.adminTab === 'listings') adminListingsSection(host);
  else adminTagsSection(host);
}

// ── Admin: reports queue ────────────────────────────────────────────────
async function adminReportsSection(host) {
  host.replaceChildren(
    h(`
    <div>
      <div class="bt-seg" id="bt-rep-filter" style="margin-bottom:12px">
        ${[['open', 'Open'], ['actioned', 'Actioned'], ['dismissed', 'Dismissed'], ['all', 'All']]
          .map(
            ([v, l]) =>
              `<button type="button" data-rf="${v}" class="bt-seg-btn${
                (state.repFilter || 'open') === v ? ' is-sel' : ''
              }">${l}</button>`
          )
          .join('')}
      </div>
      <div id="bt-rep-list"><div class="empty">Loading…</div></div>
    </div>
  `)
  );
  const listEl = host.querySelector('#bt-rep-list');
  const load = async () => {
    let r;
    try {
      r = await guard(() => API.adminReports(state.repFilter || 'open'));
    } catch {
      return;
    }
    listEl.replaceChildren();
    if (!r.reports.length) {
      listEl.appendChild(h('<div class="empty">Nothing here.</div>'));
      return;
    }
    r.reports.forEach((rep) => listEl.appendChild(reportCard(rep, load)));
  };
  on(host, '#bt-rep-filter [data-rf]', 'click', (e) => {
    state.repFilter = e.currentTarget.dataset.rf;
    host
      .querySelectorAll('#bt-rep-filter [data-rf]')
      .forEach((b) => b.classList.toggle('is-sel', b.dataset.rf === state.repFilter));
    load();
  });
  load();
}

function reportCard(rep, reload) {
  const t = rep.target || {};
  const authorName = t.author ? ownerName(t.author) : null;
  const card = h(`
    <div class="bt-rep-card">
      <div class="bt-rep-top">
        <span class="bt-rep-cat">${esc(rep.category)}</span>
        <span class="bt-rep-time">${esc(timeAgo(rep.created_at))}</span>
      </div>
      <div class="bt-rep-target">
        <b>${esc(rep.target_type)}</b>${
          t.exists ? ` — ${esc((t.preview || '').slice(0, 120))}` : ' — <i>already removed</i>'
        }${authorName ? ` · by ${esc(authorName)}` : ''}
      </div>
      ${rep.detail ? `<div class="bt-rep-detail"></div>` : ''}
      <div class="bt-rep-meta">reported by ${
        rep.reporter ? esc(ownerName(rep.reporter)) : '<i>deleted user</i>'
      }${
        rep.status !== 'open'
          ? ` · <b>${esc(rep.status)}</b>${
              rep.resolved_by ? ' by ' + esc(ownerName(rep.resolved_by)) : ''
            }${rep.resolution_note ? ' — ' + esc(rep.resolution_note) : ''}`
          : ''
      }</div>
      <div class="bt-rep-actions"></div>
    </div>
  `);
  if (rep.detail) card.querySelector('.bt-rep-detail').textContent = rep.detail;
  const actions = card.querySelector('.bt-rep-actions');

  const openTarget = () => {
    if (rep.target_type === 'profile' && t.author) openProfile(t.author.handle);
    else if (rep.target_type === 'listing') openListing(rep.target_id);
    else if (rep.target_type === 'comment' && t.listing_id) openListing(t.listing_id);
  };
  if (t.exists) {
    const view = h('<button class="btn-sm btn-sm-ghost">Open target</button>');
    view.addEventListener('click', openTarget);
    actions.appendChild(view);
  }

  if (rep.status === 'open') {
    if (t.exists && (rep.target_type === 'listing' || rep.target_type === 'comment')) {
      const rm = h('<button class="btn-sm btn-danger">Remove content</button>');
      rm.addEventListener('click', async () => {
        if (!(await btConfirm('Remove the reported content and mark this report actioned?', { danger: true, ok: 'Remove' })))
          return;
        const note = (await btPrompt('Resolution note (optional)', '')) || null;
        try {
          if (rep.target_type === 'listing') await API.deleteListing(rep.target_id);
          else await API.deleteListingComment(t.listing_id, rep.target_id);
          await API.resolveReport(rep.id, { status: 'actioned', note, removed: true });
        } catch (ex) {
          toast(ex.message || 'Could not remove');
          return;
        }
        toast('Content removed');
        reload();
      });
      actions.appendChild(rm);
    }
    if (authorName && t.author) {
      const blk = h(
        `<button class="btn-sm btn-sm-ghost">${t.board_blocked ? 'Unblock board' : 'Board block'} author</button>`
      );
      blk.addEventListener('click', () =>
        sanctionFromReport(t.author.handle, t.board_blocked ? 'board_unblock' : 'board_block', rep.id, reload)
      );
      const dis = h(
        `<button class="btn-sm btn-sm-ghost">${t.disabled ? 'Enable' : 'Disable'} author</button>`
      );
      dis.addEventListener('click', () =>
        sanctionFromReport(t.author.handle, t.disabled ? 'enable' : 'disable', rep.id, reload)
      );
      actions.append(blk, dis);
    }
    const dismiss = h('<button class="btn-sm btn-sm-ghost">Dismiss</button>');
    dismiss.addEventListener('click', async () => {
      const note = (await btPrompt('Why dismiss? (optional)', '')) || null;
      try {
        await API.resolveReport(rep.id, { status: 'dismissed', note });
      } catch (ex) {
        toast(ex.message || 'Could not dismiss');
        return;
      }
      toast('Dismissed');
      reload();
    });
    actions.appendChild(dismiss);
  }
  return card;
}

async function sanctionFromReport(handle, action, reportId, reload) {
  const verb = { board_block: 'Board block', board_unblock: 'Lift board block', disable: 'Disable', enable: 'Enable' }[action];
  if (!(await btConfirm(`${verb} @${handle}?`, { danger: action === 'disable' || action === 'board_block' })))
    return;
  const note = (await btPrompt('Note (optional)', '')) || null;
  try {
    await API.sanctionUser(handle, { action, note, reportId });
  } catch (ex) {
    toast(ex.message || 'Could not apply');
    return;
  }
  toast(`${verb} — done`);
  reload();
}

// ── Admin: users ───────────────────────────────────────────────────────
function adminUsersSection(host) {
  host.replaceChildren(
    h(`
    <div>
      <div class="sp-field">
        <input class="sp-input" id="bt-au-q" autocomplete="off" placeholder="Look up by @handle" />
      </div>
      <div id="bt-au-detail"></div>
    </div>
  `)
  );
  const q = host.querySelector('#bt-au-q');
  const detail = host.querySelector('#bt-au-detail');
  const lookup = async () => {
    const handle = q.value.trim().replace(/^@/, '');
    if (handle.length < 2) {
      detail.replaceChildren();
      return;
    }
    let d;
    try {
      d = await guard(() => API.adminUser(handle));
    } catch (ex) {
      detail.replaceChildren(h(`<div class="empty">${esc(ex.message || 'Not found')}</div>`));
      return;
    }
    detail.replaceChildren(adminUserCard(d, lookup));
  };
  let timer;
  q.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(lookup, 300);
  });
}

function adminUserCard(d, reload) {
  const u = d.user;
  const c = d.counts || {};
  const card = h(`
    <div class="bt-au-card">
      <div class="bt-au-head">
        ${avatarEl(u.display_name || u.name || u.handle, 'bt-avatar-lg')}
        <div>
          <div class="bt-au-name">${esc(u.display_name || '@' + u.handle)}${
            u.is_admin ? ' <span class="bt-admin-tag">Admin</span>' : ''
          }</div>
          <div class="sp-row-sub">@${esc(u.handle)} · ${esc(u.email)} · ${esc(u.plan)} · joined ${esc(
            fmtDate((u.created_at || '').slice(0, 10))
          )}</div>
          <div class="sp-row-sub">${c.listings || 0} listings · ${c.comments || 0} comments · ${
            c.requests || 0
          } requests · ${c.reports_filed || 0} reports filed</div>
        </div>
      </div>
      <div class="bt-au-state">
        Board: <b>${u.board_blocked_at ? 'blocked' : 'ok'}</b> ·
        Account: <b>${u.disabled_at ? 'disabled' : 'active'}</b>
      </div>
      <div class="bt-au-actions"></div>
      <div class="sp-label" style="padding-left:0;margin-top:10px">Moderation history</div>
      <div class="bt-au-history"></div>
    </div>
  `);
  const acts = card.querySelector('.bt-au-actions');
  if (!u.is_admin) {
    const mk = (action, label, danger) => {
      const b = h(`<button class="btn-sm ${danger ? 'btn-danger' : 'btn-sm-ghost'}">${label}</button>`);
      b.addEventListener('click', () => sanctionFromReport(u.handle, action, null, reload));
      return b;
    };
    acts.append(
      u.board_blocked_at ? mk('board_unblock', 'Lift board block') : mk('board_block', 'Board block', true),
      u.disabled_at ? mk('enable', 'Re-enable account') : mk('disable', 'Disable account', true)
    );
  } else {
    acts.appendChild(h('<div class="sp-row-sub">Admins can’t be sanctioned here.</div>'));
  }

  const hist = card.querySelector('.bt-au-history');
  if (!d.history.length) hist.appendChild(h('<div class="empty-section">None.</div>'));
  d.history.forEach((m) => {
    const row = h(
      `<div class="bt-au-hrow"><b>${esc(m.action)}</b> · ${esc(timeAgo(m.created_at))} · ${
        m.admin ? esc(ownerName(m.admin)) : 'system'
      }${m.note ? ' — <span></span>' : ''}</div>`
    );
    if (m.note) row.querySelector('span').textContent = m.note;
    hist.appendChild(row);
  });
  return card;
}

// ── Admin: listings ────────────────────────────────────────────────────
async function adminListingsSection(host) {
  host.replaceChildren(h('<div class="empty">Loading…</div>'));
  let r;
  try {
    r = await guard(() => API.adminListings());
  } catch {
    return;
  }
  host.replaceChildren();
  if (!r.listings.length) {
    host.appendChild(h('<div class="empty">No listings.</div>'));
    return;
  }
  const reload = () => adminListingsSection(host);
  r.listings.forEach((l) => {
    const row = h(`
      <div class="sp-row">
        <div class="sp-row-left"><div>${esc(l.headline)}<div class="sp-row-sub">${esc(
          l.status
        )} · ${esc(ownerName(l.owner))} · ${l.comment_count} comments · ${
          l.pending_requests
        } pending</div></div></div>
        <div class="bt-adm-actions">
          <button class="btn-sm btn-sm-ghost" data-open>Open</button>
          <button class="btn-sm btn-danger" data-del>Delete</button>
        </div>
      </div>
    `);
    row.querySelector('[data-open]').addEventListener('click', () => openListing(l.id));
    row.querySelector('[data-del]').addEventListener('click', async () => {
      if (!(await btConfirm(`Delete “${l.headline}”? Comments and requests go with it.`, { danger: true, ok: 'Delete' })))
        return;
      try {
        await API.deleteListing(l.id);
      } catch (ex) {
        toast(ex.message || 'Could not delete');
        return;
      }
      toast('Listing deleted');
      reload();
    });
    host.appendChild(row);
  });
}

// ── Admin: interest-tag tool ─────────────────────────────────────────────
function adminTagsSection(app) {
  app.replaceChildren(
    h(`
    <div>
      <div class="sp-field">
        <input class="sp-input" id="bt-adm-q" autocomplete="off" placeholder="Filter tags…" />
      </div>
      <div class="sp-row-sub" id="bt-adm-merge-state" style="padding:0 20px" hidden></div>
      <div id="bt-adm-list"><div class="empty">Loading…</div></div>
    </div>
  `)
  );
  const el = app;

  const listEl = el.querySelector('#bt-adm-list');
  const qInput = el.querySelector('#bt-adm-q');
  const mergeState = el.querySelector('#bt-adm-merge-state');
  let mergeFrom = null; // { slug, label } armed for merge

  const setMerge = (tag) => {
    mergeFrom = tag;
    if (tag) {
      mergeState.hidden = false;
      mergeState.textContent = `Merging “${tag.label}” — pick the tag to merge it into.`;
    } else {
      mergeState.hidden = true;
    }
    listEl.querySelectorAll('.bt-adm-row').forEach((r) => {
      r.classList.toggle('is-merge-from', !!tag && r.dataset.slug === tag.slug);
    });
  };

  const load = async () => {
    let r;
    try {
      r = await guard(() => API.adminInterests(qInput.value.trim()));
    } catch {
      return;
    }
    const tags = r.tags || [];
    listEl.replaceChildren();
    if (!tags.length) {
      listEl.appendChild(h('<div class="empty">No tags.</div>'));
      return;
    }
    tags.forEach((t) => {
      const row = h(`
        <div class="sp-row bt-adm-row" data-slug="${esc(t.slug)}">
          <div class="sp-row-left">
            <div>${esc(t.label)}<div class="sp-row-sub">@${esc(t.slug)} · ${t.usage_count} ${
              t.usage_count === 1 ? 'profile' : 'profiles'
            }</div></div>
          </div>
          <div class="bt-adm-actions">
            <button class="btn-sm btn-sm-ghost" data-rename>Rename</button>
            <button class="btn-sm btn-sm-ghost" data-merge>Merge</button>
            <button class="btn-sm btn-danger" data-del>Delete</button>
          </div>
        </div>
      `);
      row.querySelector('[data-rename]').addEventListener('click', async () => {
        const next = await btPrompt('New label', t.label);
        if (next == null) return;
        const label = next.trim();
        if (!label || label === t.label) return;
        try {
          await API.adminRenameInterest(t.slug, { label });
        } catch (ex) {
          toast(ex.message || 'Rename failed');
          return;
        }
        toast('Renamed');
        load();
      });
      row.querySelector('[data-del]').addEventListener('click', async () => {
        const ok = await btConfirm(
          `Delete “${t.label}”? It’s removed from ${t.usage_count} ${
            t.usage_count === 1 ? 'profile' : 'profiles'
          }.`,
          { danger: true, ok: 'Delete' }
        );
        if (!ok) return;
        try {
          await API.adminDeleteInterest(t.slug);
        } catch (ex) {
          toast(ex.message || 'Delete failed');
          return;
        }
        if (mergeFrom && mergeFrom.slug === t.slug) setMerge(null);
        toast('Deleted');
        load();
      });
      row.querySelector('[data-merge]').addEventListener('click', async () => {
        if (!mergeFrom) {
          setMerge({ slug: t.slug, label: t.label });
          return;
        }
        if (mergeFrom.slug === t.slug) {
          setMerge(null);
          return;
        }
        const from = mergeFrom;
        const ok = await btConfirm(
          `Merge “${from.label}” into “${t.label}”? “${from.label}” is removed and everyone tagged with it becomes tagged “${t.label}”.`,
          { danger: true, ok: 'Merge' }
        );
        if (!ok) return;
        try {
          await API.adminMergeInterests(from.slug, t.slug);
        } catch (ex) {
          toast(ex.message || 'Merge failed');
          return;
        }
        setMerge(null);
        toast('Merged');
        load();
      });
      listEl.appendChild(row);
    });
    if (mergeFrom) setMerge(mergeFrom);
  };

  let timer;
  qInput.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(load, 200);
  });
  load();
}

// ── Board ───────────────────────────────────────────────────────────────
function openListing(id) {
  state.view = 'listing';
  state.listingId = id;
  state.project = null;
  render();
}

const ownerName = (o) => (o && (o.display_name || o.name || '@' + o.handle)) || 'someone';

function taskSummaryText(l) {
  const n = l.step_count || 0;
  if (!n) return 'No tasks yet';
  return `${n} task${n === 1 ? '' : 's'} · ${l.step_done || 0} done`;
}

function upcomingStepsEl(steps) {
  if (!steps || !steps.length) return null;
  const wrap = h('<ul class="bt-listing-steps"></ul>');
  steps.forEach((s) => {
    wrap.appendChild(
      h(
        `<li>${esc(s.title)}${
          s.due_date ? ` <span class="bt-step-due">due ${esc(fmtDate(s.due_date))}</span>` : ''
        }</li>`
      )
    );
  });
  return wrap;
}

function listingCard(l) {
  const card = h(`
    <button class="bt-listing-card">
      <div class="bt-listing-head">${esc(l.headline)}</div>
      <div class="bt-listing-meta">
        ${avatarEl(ownerName(l.owner))}
        <span>${esc(ownerName(l.owner))}${
          l.owner && l.owner.supporter ? ' <span class="bt-supporter">Supporter</span>' : ''
        } · ${esc(l.project_title)}</span>
      </div>
      <div class="bt-listing-sub">${esc(taskSummaryText(l))} · listed ${esc(
        fmtDate((l.listed_at || '').slice(0, 10))
      )}</div>
    </button>
  `);
  const steps = upcomingStepsEl(l.upcoming_steps);
  if (steps) card.appendChild(steps);
  card.addEventListener('click', () => openListing(l.id));
  return card;
}

function renderBoard(main) {
  main.replaceChildren();
  const modeBar = h(`
    <div class="bt-home-modes">
      <button class="bt-home-mode${state.boardMode !== 'activity' ? ' active' : ''}" data-bmode="listings">Listings</button>
      <button class="bt-home-mode${state.boardMode === 'activity' ? ' active' : ''}" data-bmode="activity">Activity</button>
    </div>
  `);
  const body = h('<div class="bt-board-body"></div>');
  on(modeBar, '[data-bmode]', 'click', (e) => {
    state.boardMode = e.currentTarget.dataset.bmode;
    renderBoard(main);
  });
  main.appendChild(modeBar);
  main.appendChild(body);
  if (state.boardMode === 'activity') renderBoardActivity(body);
  else renderBoardListings(body);
}

async function renderBoardListings(main) {
  main.replaceChildren(h('<div class="empty">Loading…</div>'));
  let cursor = null;
  let first = true;
  let wrap;

  const loadMore = async (btn) => {
    let r;
    try {
      r = await guard(() => API.board(cursor));
    } catch {
      if (first) main.replaceChildren(h('<div class="empty">Could not load the board.</div>'));
      return;
    }
    if (first) {
      main.replaceChildren();
      main.appendChild(
        h(
          '<div class="bt-board-intro">Projects looking for a hand. Comment, or ask to contribute — an accepted request adds you as a viewer.</div>'
        )
      );
      wrap = h('<div class="bt-listing-list"></div>');
      main.appendChild(wrap);
      first = false;
    }
    if (btn) btn.remove();
    (r.listings || []).forEach((l) => wrap.appendChild(listingCard(l)));
    if (!wrap.children.length) {
      wrap.appendChild(h('<div class="empty">No open listings right now.</div>'));
    }
    cursor = r.next_cursor;
    if (cursor) {
      const b = h('<button class="btn-sm btn-sm-ghost bt-loadmore">Load more</button>');
      b.addEventListener('click', () => loadMore(b));
      main.appendChild(b);
    }
  };

  loadMore(null);
}

const FEED_VERB = { listing: 'listed a project', comment: 'commented on a listing' };

function feedEventEl(ev) {
  const who = ownerName(ev.actor);
  const el = h(`
    <button class="bt-feed-row${ev.from_followed ? ' is-followed' : ''}">
      <div class="bt-feed-head">
        ${avatarEl(who)}
        <span class="bt-feed-who">${esc(who)}${
          ev.actor && ev.actor.supporter ? ' <span class="bt-supporter">Supporter</span>' : ''
        }</span>
        ${ev.from_followed ? '<span class="bt-feed-tag">you follow</span>' : ''}
        <span class="bt-feed-time">${esc(timeAgo(ev.created_at))}</span>
      </div>
      <div class="bt-feed-line">${esc(FEED_VERB[ev.kind] || 'posted')} · <b>${esc(ev.project_title)}</b></div>
      ${ev.preview ? '<div class="bt-feed-preview"></div>' : ''}
    </button>
  `);
  if (ev.preview) el.querySelector('.bt-feed-preview').textContent = ev.preview;
  el.addEventListener('click', () => openListing(ev.listing_id));
  return el;
}

async function renderBoardActivity(main) {
  main.replaceChildren();
  const filterBar = h(`
    <div class="bt-feed-filter">
      <button class="bt-quick-cap${state.feedFilter !== 'following' ? ' active' : ''}" data-ffilter="all">All activity</button>
      <button class="bt-quick-cap${state.feedFilter === 'following' ? ' active' : ''}" data-ffilter="following">Following</button>
    </div>
  `);
  const list = h('<div class="bt-feed-list"><div class="empty">Loading…</div></div>');
  main.appendChild(filterBar);
  main.appendChild(list);

  let cursor = null;
  let first = true;

  const loadMore = async (btn) => {
    let r;
    try {
      r = await guard(() => API.feed(state.feedFilter, cursor));
    } catch {
      if (first) list.replaceChildren(h('<div class="empty">Could not load activity.</div>'));
      return;
    }
    if (first) {
      list.replaceChildren();
      first = false;
    }
    if (btn) btn.remove();
    (r.events || []).forEach((ev) => list.appendChild(feedEventEl(ev)));
    if (!list.children.length) {
      list.appendChild(
        h(
          `<div class="empty">${
            state.feedFilter === 'following'
              ? 'No recent activity from people you follow.'
              : 'No board activity yet.'
          }</div>`
        )
      );
    }
    cursor = r.next_cursor;
    if (cursor) {
      const b = h('<button class="btn-sm btn-sm-ghost bt-loadmore">Load more</button>');
      b.addEventListener('click', () => loadMore(b));
      main.appendChild(b);
    }
  };

  on(filterBar, '[data-ffilter]', 'click', (e) => {
    state.feedFilter = e.currentTarget.dataset.ffilter;
    renderBoardActivity(main);
  });

  loadMore(null);
}

// headline + body editor for a listing. `existing` is a listing object for edit,
// or null to create for `projectId`.
function openListingForm(projectId, existing, onDone) {
  const overlay = h(`
    <div class="modal-overlay open">
      <div class="modal">
        <div class="modal-header"><span class="modal-title">${
          existing ? 'Edit listing' : 'List on the board'
        }</span>
          <button class="modal-close" aria-label="Close">${icon('close')}</button></div>
        <form id="bt-lf">
          <label class="sp-label">Headline</label>
          <input class="sp-input" name="headline" maxlength="120" required
            value="${esc(existing ? existing.headline : '')}" placeholder="One line — what you're after" />
          <label class="sp-label">What do you need help with?</label>
          <textarea class="sp-input bt-textarea" name="help_wanted" maxlength="2000" rows="5"
            required placeholder="Tasks, skills, time commitment — whatever helps someone decide.">${esc(
              existing ? existing.help_wanted : ''
            )}</textarea>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button type="submit" class="btn-sm btn-sm-sage">${existing ? 'Save' : 'Post listing'}</button>
            <button type="button" class="btn-sm btn-sm-ghost" data-cancel>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `);
  const close = () => overlay.remove();
  on(overlay, '.modal-close, [data-cancel]', 'click', close);
  overlay.addEventListener('click', (e) => e.target === overlay && close());
  on(overlay, '#bt-lf', 'submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const payload = {
      headline: f.get('headline').trim(),
      help_wanted: f.get('help_wanted').trim(),
    };
    try {
      if (existing) {
        await API.updateListing(existing.id, payload);
        toast('Listing updated');
        close();
        onDone && onDone(existing.id);
      } else {
        const r = await API.createListing({ ...payload, projectId });
        close();
        onDone && onDone(r.listing.id);
      }
    } catch (ex) {
      toast(ex.message || 'Could not save the listing');
    }
  });
  document.body.appendChild(overlay);
  overlay.querySelector('input[name=headline]').focus();
}

function openRequestModal(listingId, onDone) {
  const overlay = h(`
    <div class="modal-overlay open">
      <div class="modal">
        <div class="modal-header"><span class="modal-title">Ask to contribute</span>
          <button class="modal-close" aria-label="Close">${icon('close')}</button></div>
        <form id="bt-rq">
          <label class="sp-label">Message to the owner <span class="bt-count">optional</span></label>
          <textarea class="sp-input bt-textarea" name="message" maxlength="1000" rows="4"
            placeholder="How you'd like to help, relevant experience…"></textarea>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button type="submit" class="btn-sm btn-sm-sage">Send request</button>
            <button type="button" class="btn-sm btn-sm-ghost" data-cancel>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `);
  const close = () => overlay.remove();
  on(overlay, '.modal-close, [data-cancel]', 'click', close);
  overlay.addEventListener('click', (e) => e.target === overlay && close());
  on(overlay, '#bt-rq', 'submit', async (e) => {
    e.preventDefault();
    const msg = new FormData(e.target).get('message').trim();
    try {
      await API.requestContribute(listingId, msg || null);
      close();
      toast('Request sent');
      onDone && onDone();
    } catch (ex) {
      toast(ex.message || 'Could not send the request');
    }
  });
  document.body.appendChild(overlay);
  overlay.querySelector('textarea').focus();
}

function listingCommentEl(c, listingId, rerender) {
  const who = c.author ? ownerName(c.author) : 'removed';
  const el = h(`
    <div class="bt-cmt${c.parent_comment_id ? ' bt-cmt-reply' : ''}">
      <div class="bt-cmt-head">
        ${c.author ? avatarEl(who) : ''}
        <span class="bt-cmt-who">${c.deleted ? '<i>comment removed</i>' : esc(who)}</span>
        <span class="bt-cmt-time">${esc(timeAgo(c.created_at))}${c.edited_at ? ' · edited' : ''}</span>
      </div>
      ${c.deleted ? '' : `<div class="bt-cmt-body"></div>`}
      <div class="bt-cmt-actions"></div>
    </div>
  `);
  if (!c.deleted) el.querySelector('.bt-cmt-body').textContent = c.body;
  const actions = el.querySelector('.bt-cmt-actions');

  if (!c.deleted && !c.parent_comment_id) {
    const reply = h('<button class="bt-linkbtn">Reply</button>');
    reply.addEventListener('click', () => {
      if (el.querySelector('.bt-cmt-replybox')) return;
      const box = h(`
        <div class="bt-cmt-replybox">
          <textarea class="sp-input bt-textarea" rows="2" maxlength="2000" placeholder="Reply…"></textarea>
          <div style="display:flex;gap:8px;margin-top:6px">
            <button class="btn-sm btn-sm-sage" data-send>Reply</button>
            <button class="btn-sm btn-sm-ghost" data-cancel>Cancel</button>
          </div>
        </div>
      `);
      on(box, '[data-cancel]', 'click', () => box.remove());
      on(box, '[data-send]', 'click', async () => {
        const v = box.querySelector('textarea').value.trim();
        if (!v) return;
        try {
          await API.addListingComment(listingId, v, c.id);
        } catch (ex) {
          toast(ex.message || 'Could not reply');
          return;
        }
        rerender();
      });
      el.appendChild(box);
      box.querySelector('textarea').focus();
    });
    actions.appendChild(reply);
  }
  if (!c.deleted && c.is_mine) {
    const edit = h('<button class="bt-linkbtn">Edit</button>');
    edit.addEventListener('click', async () => {
      const next = await btPrompt('Edit comment', c.body);
      if (next == null || !next.trim() || next.trim() === c.body) return;
      try {
        await API.editListingComment(listingId, c.id, next.trim());
      } catch (ex) {
        toast(ex.message || 'Could not edit');
        return;
      }
      rerender();
    });
    actions.appendChild(edit);
  }
  if (!c.deleted && c.can_delete) {
    const del = h('<button class="bt-linkbtn bt-linkbtn-danger">Delete</button>');
    del.addEventListener('click', async () => {
      if (!(await btConfirm('Delete this comment?', { danger: true, ok: 'Delete' }))) return;
      try {
        await API.deleteListingComment(listingId, c.id);
      } catch (ex) {
        toast(ex.message || 'Could not delete');
        return;
      }
      rerender();
    });
    actions.appendChild(del);
  }
  if (!c.deleted && !c.is_mine) {
    const rep = h('<button class="bt-linkbtn">Report</button>');
    rep.addEventListener('click', () => openReportModal('comment', c.id));
    actions.appendChild(rep);
  }

  (c.replies || []).forEach((r) => el.appendChild(listingCommentEl(r, listingId, rerender)));
  return el;
}

async function renderListing(app) {
  app.replaceChildren();
  const el = h(`
    <div class="settings-screen">
      <div class="settings-body">
        <div class="detail-topbar"><button class="detail-back" id="bt-lst-back">← Board</button></div>
        <div id="bt-lst-body"><div class="empty">Loading…</div></div>
      </div>
    </div>
  `);
  on(el, '#bt-lst-back', 'click', () => {
    state.view = 'board';
    render();
  });
  app.appendChild(el);

  const rerender = () => renderListing(app);
  let d;
  try {
    d = await guard(() => API.listing(state.listingId));
  } catch {
    el.querySelector('#bt-lst-body').replaceChildren(h('<div class="empty">Listing not found.</div>'));
    return;
  }
  const l = d.listing;
  const body = el.querySelector('#bt-lst-body');
  body.replaceChildren();

  const head = h(`
    <div>
      <h1 class="detail-title">${esc(l.headline)}${
        l.status !== 'open' ? ` <span class="bt-listing-status">${esc(l.status)}</span>` : ''
      }</h1>
      <div class="bt-listing-meta">
        ${avatarEl(ownerName(l.owner))}
        <span>${esc(ownerName(l.owner))}${
          l.owner.supporter ? ' <span class="bt-supporter">Supporter</span>' : ''
        } · ${esc(l.project_title)} · started ${esc(
          fmtDate((l.project_created_at || '').slice(0, 10))
        )}</span>
      </div>
      <div class="bt-listing-sub">${esc(taskSummaryText(l))}</div>
    </div>
  `);
  const steps = upcomingStepsEl(l.upcoming_steps);
  if (steps) head.appendChild(steps);
  body.appendChild(head);

  const bodyText = h('<div class="sp-section"><div class="sp-label">Help wanted</div><div class="bt-prof-bio"></div></div>');
  bodyText.querySelector('.bt-prof-bio').textContent = l.help_wanted;
  body.appendChild(bodyText);

  // action area
  const act = h('<div class="bt-prof-actions"></div>');
  if (d.is_owner) {
    const edit = h(`<button class="btn-sm btn-sm-ghost">${icon('edit', 16)} Edit</button>`);
    edit.addEventListener('click', () => openListingForm(l.project_id, l, rerender));
    const statusSel = h(`
      <select class="sp-select" style="width:auto;margin:0">
        ${['open', 'closed', 'archived']
          .map((s) => `<option value="${s}"${l.status === s ? ' selected' : ''}>${s}</option>`)
          .join('')}
      </select>
    `);
    statusSel.addEventListener('change', async (e) => {
      try {
        await API.updateListing(l.id, { status: e.target.value });
        toast('Status updated');
        rerender();
      } catch (ex) {
        toast(ex.message || 'Could not update');
      }
    });
    const del = h('<button class="btn-sm btn-danger">Delete</button>');
    del.addEventListener('click', async () => {
      if (
        !(await btConfirm('Delete this listing? Comments and requests go with it.', {
          danger: true,
          ok: 'Delete',
        }))
      )
        return;
      try {
        await API.deleteListing(l.id);
      } catch (ex) {
        toast(ex.message || 'Could not delete');
        return;
      }
      state.view = 'board';
      render();
    });
    act.append(edit, statusSel, del);
  } else if (d.my_role) {
    act.appendChild(
      h(`<div class="sp-row-sub">You have ${esc(d.my_role)} access to this project.</div>`)
    );
    const open = h('<button class="btn-sm btn-sm-ghost">Open project</button>');
    open.addEventListener('click', () => openProject(l.project_id));
    act.appendChild(open);
  } else if (d.my_request && d.my_request.status === 'pending') {
    act.appendChild(h('<div class="sp-row-sub">Your request is pending.</div>'));
    const wd = h('<button class="btn-sm btn-sm-ghost">Withdraw request</button>');
    wd.addEventListener('click', async () => {
      try {
        await API.withdrawRequest(l.id, d.my_request.id);
        toast('Request withdrawn');
        rerender();
      } catch (ex) {
        toast(ex.message || 'Could not withdraw');
      }
    });
    act.appendChild(wd);
  } else {
    if (d.my_request && (d.my_request.status === 'declined' || d.my_request.status === 'withdrawn')) {
      act.appendChild(
        h(
          `<div class="sp-row-sub">Your earlier request was ${esc(d.my_request.status)}.</div>`
        )
      );
    }
    if (l.status === 'open') {
      const req = h('<button class="btn-sm btn-sm-sage">Ask to contribute</button>');
      req.addEventListener('click', () => openRequestModal(l.id, rerender));
      act.appendChild(req);
    } else {
      act.appendChild(h('<div class="sp-row-sub">This listing isn’t taking requests.</div>'));
    }
  }
  if (!d.is_owner) {
    const rep = h('<button class="bt-linkbtn" style="margin:2px 20px 0">Report this listing</button>');
    rep.addEventListener('click', () => openReportModal('listing', l.id));
    act.appendChild(rep);
  }
  body.appendChild(act);

  // pending requests (owner)
  if (d.is_owner && d.requests) {
    const sec = h(
      `<div class="sp-section"><div class="sp-label">Requests${
        d.requests.length ? ` (${d.requests.length})` : ''
      }</div><div id="bt-lst-reqs"></div></div>`
    );
    const rl = sec.querySelector('#bt-lst-reqs');
    if (!d.requests.length) rl.appendChild(h('<div class="empty-section">No pending requests.</div>'));
    d.requests.forEach((rq) => {
      const row = h(`
        <div class="bt-req-row">
          <div class="bt-req-main">
            ${avatarEl(ownerName(rq.requester))}
            <div>
              <div class="bt-req-who">${esc(ownerName(rq.requester))}${
                rq.requester.supporter ? ' <span class="bt-supporter">Supporter</span>' : ''
              }</div>
              ${rq.message ? `<div class="bt-req-msg"></div>` : ''}
            </div>
          </div>
          <div class="bt-req-actions">
            <button class="btn-sm btn-sm-sage" data-accept>Accept</button>
            <button class="btn-sm btn-sm-ghost" data-decline>Decline</button>
          </div>
        </div>
      `);
      if (rq.message) row.querySelector('.bt-req-msg').textContent = rq.message;
      const decide = async (status) => {
        try {
          await API.decideRequest(l.id, rq.id, status);
          toast(status === 'accepted' ? 'Added as a viewer' : 'Request declined');
          rerender();
        } catch (ex) {
          toast(ex.message || 'Could not update the request');
        }
      };
      row.querySelector('[data-accept]').addEventListener('click', () => decide('accepted'));
      row.querySelector('[data-decline]').addEventListener('click', () => decide('declined'));
      rl.appendChild(row);
    });
    body.appendChild(sec);
  }

  // comments
  const cSec = h(
    '<div class="sp-section"><div class="sp-label">Comments</div><div id="bt-lst-comments"></div></div>'
  );
  const cList = cSec.querySelector('#bt-lst-comments');
  const composer = h(`
    <div class="bt-cmt-composer">
      <textarea class="sp-input bt-textarea" rows="3" maxlength="2000" placeholder="Add a comment…"></textarea>
      <button class="btn-sm btn-sm-sage" data-send style="margin-top:6px">Comment</button>
    </div>
  `);
  on(composer, '[data-send]', 'click', async () => {
    const v = composer.querySelector('textarea').value.trim();
    if (!v) return;
    try {
      await API.addListingComment(l.id, v);
    } catch (ex) {
      toast(ex.message || 'Could not comment');
      return;
    }
    rerender();
  });
  cList.appendChild(composer);
  if (!d.comments.length) {
    cList.appendChild(h('<div class="empty-section">No comments yet.</div>'));
  } else {
    d.comments.forEach((c) => cList.appendChild(listingCommentEl(c, l.id, rerender)));
  }
  body.appendChild(cSec);
}

// ── Reporting ──────────────────────────────────────────────────────────
// Renders a Turnstile widget into `box`. Returns () => token|''.
function mountTurnstileWidget(box) {
  let id = null;
  let tries = 0;
  const tick = () => {
    if (window.turnstile) id = window.turnstile.render(box, { sitekey: TURNSTILE_SITE_KEY });
    else if (tries++ < 60) setTimeout(tick, 200);
  };
  tick();
  return () => (window.turnstile && id != null ? window.turnstile.getResponse(id) : '');
}

const REPORT_CATEGORIES = [
  ['spam', 'Spam or advertising'],
  ['harassment', 'Harassment or abuse'],
  ['illegal', 'Illegal or infringing'],
  ['other', 'Something else'],
];

function openReportModal(targetType, targetId, onDone) {
  const needsTs = !!(state.me && state.me.board_new);
  const overlay = h(`
    <div class="modal-overlay open">
      <div class="modal">
        <div class="modal-header"><span class="modal-title">Report this ${esc(targetType)}</span>
          <button class="modal-close" aria-label="Close">${icon('close')}</button></div>
        <div class="msg err" id="bt-rp-err" hidden></div>
        <form id="bt-rp-form">
          <label class="sp-label">Reason</label>
          ${REPORT_CATEGORIES.map(
            ([v, l], i) =>
              `<label class="bt-radio"><input type="radio" name="category" value="${v}"${
                i === 0 ? ' checked' : ''
              }> ${l}</label>`
          ).join('')}
          <label class="sp-label">Details <span class="bt-count">optional</span></label>
          <textarea class="sp-input bt-textarea" name="detail" rows="3" maxlength="1000"
            placeholder="Anything that helps a moderator."></textarea>
          ${needsTs ? '<div id="bt-rp-ts" style="margin:8px 0"></div>' : ''}
          <div style="display:flex;gap:8px;margin-top:8px">
            <button type="submit" class="btn-sm btn-sm-sage">Send report</button>
            <button type="button" class="btn-sm btn-sm-ghost" data-cancel>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `);
  const close = () => overlay.remove();
  const err = overlay.querySelector('#bt-rp-err');
  on(overlay, '.modal-close, [data-cancel]', 'click', close);
  overlay.addEventListener('click', (e) => e.target === overlay && close());
  const getToken = needsTs ? mountTurnstileWidget(overlay.querySelector('#bt-rp-ts')) : () => '';

  on(overlay, '#bt-rp-form', 'submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    err.hidden = true;
    try {
      await API.report({
        targetType,
        targetId,
        category: f.get('category'),
        detail: (f.get('detail') || '').trim() || null,
        turnstileToken: getToken(),
      });
      close();
      toast('Report sent — thank you');
      onDone && onDone();
    } catch (ex) {
      err.textContent = ex.message || 'Could not send the report';
      err.hidden = false;
    }
  });
  document.body.appendChild(overlay);
}

// ── Notifications ───────────────────────────────────────────────────────
function notifLine(n) {
  const who = n.actor ? (n.actor.display_name || n.actor.name || '@' + n.actor.handle) : 'Someone';
  const p = n.preview ? ` “${n.preview}”` : '';
  switch (n.type) {
    case 'follow':
      return `${who} started following you`;
    case 'contributor_request':
      return `${who} asked to contribute${p}`;
    case 'contributor_decided':
      return `Your contributor request was ${n.preview || 'decided'}`;
    case 'board_comment':
      return `${who} commented on your listing${p}`;
    case 'board_reply':
      return `${who} replied to your comment${p}`;
    default:
      return 'New activity';
  }
}
function notifNav(n) {
  if (n.type === 'follow' && n.actor) return () => openProfile(n.actor.handle);
  if (n.subject_type === 'listing' && n.subject_id) return () => openListing(n.subject_id);
  return null;
}

function openNotifPanel(anchorBtn) {
  const existing = document.querySelector('.bt-notif-pop');
  if (existing) {
    existing.remove();
    return;
  }
  const pop = h(`
    <div class="bt-notif-pop">
      <div class="bt-notif-head">Notifications</div>
      <div class="bt-notif-list"><div class="empty-section">Loading…</div></div>
    </div>
  `);
  document.body.appendChild(pop);
  const listEl = pop.querySelector('.bt-notif-list');

  const closeOnOutside = (e) => {
    if (!pop.contains(e.target) && e.target !== anchorBtn && !anchorBtn.contains(e.target)) {
      pop.remove();
      document.removeEventListener('mousedown', closeOnOutside);
    }
  };
  setTimeout(() => document.addEventListener('mousedown', closeOnOutside), 0);

  (async () => {
    let r;
    try {
      r = await API.notifications();
    } catch {
      listEl.replaceChildren(h('<div class="empty-section">Could not load notifications.</div>'));
      return;
    }
    listEl.replaceChildren();
    if (!r.notifications.length) {
      listEl.appendChild(h('<div class="empty-section">Nothing yet.</div>'));
    } else {
      r.notifications.forEach((n) => {
        const row = h(`
          <button class="bt-notif-row${n.read_at ? '' : ' is-unread'}">
            ${n.actor ? avatarEl(n.actor.display_name || n.actor.name || n.actor.handle) : ''}
            <span class="bt-notif-main">
              <span class="bt-notif-text"></span>
              <span class="bt-notif-time">${esc(timeAgo(n.created_at))}</span>
            </span>
          </button>
        `);
        row.querySelector('.bt-notif-text').textContent = notifLine(n);
        const nav = notifNav(n);
        row.addEventListener('click', () => {
          pop.remove();
          document.removeEventListener('mousedown', closeOnOutside);
          if (nav) nav();
        });
        listEl.appendChild(row);
      });
    }
    // Opening the panel clears the unread state.
    if (state.me && state.me.unread_count) {
      try {
        await API.markNotificationsRead();
      } catch {
        /* leave the badge; it'll clear next load */
      }
      state.me.unread_count = 0;
      const dot = anchorBtn.querySelector('.bt-bell-dot');
      if (dot) dot.remove();
    }
  })();
}

// ── Sign-in ────────────────────────────────────────────────────────────────
let tsWidgetId = null;

function renderAuth() {
  const invalid = new URLSearchParams(location.search).get('auth') === 'invalid';
  root().replaceChildren(
    h(`
    <div class="bt-auth">
      <div class="wordmark">brambletally<span>.</span></div>
      <div class="tagline">a keeping-book for makers</div>
      <p class="sub">A place to track A&amp;S projects, personal research, and Chatelaine office work &mdash; steps, supplies, a timeline, a focus timer, and projects you share with others.</p>
      <h1>Sign in</h1>
      <p class="sub">Enter your email and we'll send a one-time link. No password.</p>
      ${invalid ? '<div class="msg err">That link was invalid or expired. Request a new one.</div>' : ''}
      <div class="msg ok" id="bt-auth-ok" hidden></div>
      <div class="msg err" id="bt-auth-err" hidden></div>
      <form id="bt-auth-form">
        <label for="bt-email">Email</label>
        <input type="email" id="bt-email" autocomplete="email" required placeholder="you@example.com" />
        <div id="bt-ts"></div>
        <button type="submit" class="btn-primary" id="bt-auth-submit">Send link</button>
      </form>
      <a class="back" href="https://rayhanasrepositorium.com/">← Rayhana's Repositorium</a>
    </div>
  `)
  );
  mountTurnstile();
  document.getElementById('bt-auth-form').addEventListener('submit', onRequestLink);
}

function mountTurnstile() {
  const box = document.getElementById('bt-ts');
  if (!box) return;
  let tries = 0;
  const tick = () => {
    if (window.turnstile) tsWidgetId = window.turnstile.render(box, { sitekey: TURNSTILE_SITE_KEY });
    else if (tries++ < 60) setTimeout(tick, 200);
  };
  tick();
}

async function onRequestLink(e) {
  e.preventDefault();
  const email = document.getElementById('bt-email').value.trim();
  const btn = document.getElementById('bt-auth-submit');
  const ok = document.getElementById('bt-auth-ok');
  const err = document.getElementById('bt-auth-err');
  ok.hidden = true;
  err.hidden = true;
  const token = window.turnstile && tsWidgetId != null ? window.turnstile.getResponse(tsWidgetId) : '';
  btn.disabled = true;
  btn.textContent = 'Sending…';
  try {
    await API.requestLink(email, token);
    ok.textContent = `Check ${email} for a sign-in link. It expires in 15 minutes.`;
    ok.hidden = false;
    document.getElementById('bt-auth-form').reset();
  } catch (ex) {
    err.textContent = ex.message;
    err.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send link';
    if (window.turnstile && tsWidgetId != null) window.turnstile.reset(tsWidgetId);
  }
}

// ── App shell ──────────────────────────────────────────────────────────────
function header() {
  const nav = [
    ['home', 'Projects'],
    ['next', 'Next'],
    ['inbox', 'Inbox'],
    ['review', 'Review'],
    ['board', 'Board'],
  ];
  const el = h(`
    <div class="header">
      <div class="header-row">
        <div>
          <div class="wordmark">brambletally<span>.</span>${
            state.me && state.me.supporter ? '<span class="bt-supporter">Supporter</span>' : ''
          }</div>
          <div class="tagline">a keeping-book for makers</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn-icon" id="bt-theme" title="Light / dark" aria-label="Toggle light or dark">${
            effectiveTheme() === 'dark' ? icon('sun') : icon('moon')
          }</button>
          <button class="btn-icon bt-bell" id="bt-notif" title="Notifications" aria-label="Notifications">${icon(
            'bell'
          )}${
            state.me && state.me.unread_count
              ? `<span class="bt-bell-dot">${state.me.unread_count > 9 ? '9+' : state.me.unread_count}</span>`
              : ''
          }</button>
          <button class="btn-icon" id="bt-search" title="Search" aria-label="Search">${icon('search')}</button>
          <button class="btn-icon" id="bt-settings" title="Settings" aria-label="Settings">${icon('settings')}</button>
          <button class="btn-sm btn-sm-ghost" id="bt-signout">Sign out</button>
        </div>
      </div>
      <nav class="topnav" id="bt-nav">
        ${nav
          .map(
            ([v, label]) =>
              `<button class="topnav-item${state.view === v ? ' active' : ''}" data-view="${v}">${label}</button>`
          )
          .join('')}
      </nav>
    </div>
  `);
  on(el, '#bt-signout', 'click', async () => {
    try {
      await API.logout();
    } catch {
      /* ignore */
    }
    location.href = APP_PATH;
  });
  on(el, '#bt-theme', 'click', toggleTheme);
  on(el, '#bt-notif', 'click', (e) => openNotifPanel(e.currentTarget));
  on(el, '#bt-settings', 'click', () => {
    state.view = 'settings';
    state.project = null;
    render();
  });
  on(el, '#bt-search', 'click', () => {
    state.viewBeforeSearch = state.view;
    state.view = 'search';
    render();
  });
  on(el, '[data-view]', 'click', (e) => {
    state.view = e.currentTarget.dataset.view;
    state.project = null;
    render();
  });
  return el;
}

function renderApp() {
  const app = root();
  app.replaceChildren();
  if (state.view === 'project') {
    renderProject(app);
    return;
  }
  if (state.view === 'search') {
    renderSearch(app);
    return;
  }
  if (state.view === 'settings') {
    renderSettings(app);
    return;
  }
  if (state.view === 'profile') {
    renderProfile(app);
    return;
  }
  if (state.view === 'profile-edit') {
    renderProfileEdit(app);
    return;
  }
  if (state.view === 'discover') {
    renderDiscover(app);
    return;
  }
  if (state.view === 'follows') {
    renderFollowList(app);
    return;
  }
  if (state.view === 'blocked') {
    renderBlocked(app);
    return;
  }
  if (state.view === 'admin') {
    renderAdmin(app);
    return;
  }
  if (state.view === 'listing') {
    renderListing(app);
    return;
  }
  app.appendChild(header());
  const main = h(`<div class="project-list${state.view === 'home' ? ' is-home' : ''}"></div>`);
  app.appendChild(main);
  if (state.view === 'home') renderHome(main);
  else if (state.view === 'archived') renderArchived(main);
  else if (state.view === 'next') renderNext(main);
  else if (state.view === 'inbox') renderInbox(main);
  else if (state.view === 'review') renderReview(main);
  else if (state.view === 'board') renderBoard(main);
}

// ── Archived projects ─────────────────────────────────────────────────────
async function renderArchived(main) {
  main.replaceChildren(h('<div class="empty">Loading…</div>'));
  let projects;
  try {
    ({ projects } = await guard(() => API.listProjects({ archived: true })));
  } catch {
    return;
  }

  const wrap = h('<div></div>');
  const bar = h(
    `<div class="detail-topbar"><button class="detail-back" id="bt-arch-back">← Back</button></div>`
  );
  on(bar, '#bt-arch-back', 'click', () => {
    state.view = 'home';
    renderApp();
  });
  wrap.appendChild(bar);
  wrap.appendChild(h('<h1 class="detail-title">Archived</h1>'));

  if (!projects.length) {
    wrap.appendChild(h('<div class="empty">No archived projects.</div>'));
  } else {
    const grid = h('<div class="cards-grid"></div>');
    projects.forEach((p) => {
      const card = projectCard(p);
      const un = h(
        '<button class="btn-sm btn-sm-ghost" style="margin-top:8px">Unarchive</button>'
      );
      un.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await guard(() => API.updateProject(p.id, { archived: false }));
        } catch {
          return;
        }
        toast('Unarchived');
        renderArchived(main);
      });
      card.appendChild(un);
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
  }
  main.replaceChildren(wrap);
}

// ── Home / project list ────────────────────────────────────────────────────
async function renderHome(main) {
  main.replaceChildren(h('<div class="empty">Loading…</div>'));
  let projects, review, sessionData;
  try {
    [{ projects }, , review, sessionData] = await Promise.all([
      guard(() => API.listProjects()),
      loadCategories(),
      API.review().catch(() => ({ active: [], waiting: [] })),
      API.mySessions().catch(() => ({ sessions: [] })),
    ]);
  } catch {
    return;
  }
  state.projects = projects;

  const counts = {};
  STATUSES.forEach((s) => (counts[s] = projects.filter((p) => p.status === s).length));

  const wrap = h('<div></div>');

  // Overdue / due-today steps across Active + Waiting For projects.
  const today = new Date().toISOString().slice(0, 10);
  const dueItems = [];
  [...(review.active || []), ...(review.waiting || [])].forEach((pr) => {
    const titleById = new Map((pr.open_steps || []).map((st) => [st.id, st.title]));
    withoutContainers(pr.open_steps || []).forEach((st) => {
      if (st.due_date && st.due_date <= today) {
        dueItems.push({
          ...st,
          projectId: pr.id,
          projectTitle: pr.title,
          parentTitle: st.parent_step_id ? titleById.get(st.parent_step_id) : undefined,
          overdue: st.due_date < today,
        });
      }
    });
  });
  dueItems.sort((a, b) => (a.due_date < b.due_date ? -1 : 1));
  if (dueItems.length) {
    const band = h(`<div class="due-band"><div class="due-band-head">Due now &middot; ${dueItems.length}</div></div>`);
    dueItems.slice(0, 6).forEach((it) => {
      const row = h(`
        <button class="due-band-row">
          <span class="due-band-title">${crumb(it.title, it.parentTitle)}</span>
          <span class="due-band-sub">${esc(it.projectTitle)} · <span class="${
            it.overdue ? 'due-over' : 'due-today'
          }">${it.overdue ? 'overdue' : 'today'}</span></span>
        </button>
      `);
      row.addEventListener('click', () => openProject(it.projectId));
      band.appendChild(row);
    });
    wrap.appendChild(band);
  }

  const nextFocus = (sessionData.sessions || []).find((s) => s.status === 'planned');
  if (nextFocus) {
    const soon = sessionIsSoon(nextFocus);
    const line = h(`
      <button class="bt-nextfocus${soon ? ' is-soon' : ''}">
        <span class="bt-nextfocus-label">${soon ? 'Focus time now' : 'Next focus'}</span>
        <span class="bt-nextfocus-body">${esc(nextFocus.project_title)} · ${esc(
          fmtSessionWhen(nextFocus.starts_at, nextFocus.ends_at)
        )}</span>
        <span class="bt-nextfocus-go">${soon ? 'Start now' : 'Open'}</span>
      </button>
    `);
    line.addEventListener('click', async () => {
      await openProject(nextFocus.project_id);
      if (soon && state.project) {
        openFocusSession(state.project, {
          stepId: nextFocus.step_id,
          planSessionId: nextFocus.id,
        });
      }
    });
    wrap.appendChild(line);
  }

  const modes = h(`
    <div class="bt-home-modes">
      <button class="bt-home-mode${state.homeMode === 'projects' ? ' active' : ''}" data-mode="projects">Projects</button>
      <button class="bt-home-mode${state.homeMode === 'quick' ? ' active' : ''}" data-mode="quick">Quick tasks</button>
      <button class="bt-home-mode${state.homeMode === 'mine' ? ' active' : ''}" data-mode="mine">My tasks</button>
    </div>
  `);
  on(modes, '.bt-home-mode', 'click', (e) => {
    state.homeMode = e.currentTarget.dataset.mode;
    renderApp();
  });
  wrap.appendChild(modes);

  if (state.homeMode === 'quick') {
    renderQuickTasks(wrap, review);
    main.replaceChildren(wrap);
    return;
  }
  if (state.homeMode === 'mine') {
    await renderMyTasks(wrap);
    main.replaceChildren(wrap);
    return;
  }

  const statusTabs = h(`<div class="tabs" style="margin-bottom:8px"></div>`);
  STATUSES.forEach((s) => {
    const b = h(
      `<button class="tab${state.filterStatus === s ? ' active' : ''}" style="--tab-color:${STATUS_COLOR[s]}">${s}${
        counts[s] ? `<span class="tab-count">${counts[s]}</span>` : ''
      }</button>`
    );
    b.addEventListener('click', () => {
      state.filterStatus = s;
      renderApp();
    });
    statusTabs.appendChild(b);
  });
  const archTab = h(
    `<button class="tab" style="--tab-color:var(--text-muted)">Archived</button>`
  );
  archTab.addEventListener('click', () => {
    state.view = 'archived';
    renderApp();
  });
  statusTabs.appendChild(archTab);
  wrap.appendChild(statusTabs);

  const catFilters = [['all', 'All']];
  state.categories.forEach((c) => catFilters.push([c.name, c.name]));
  if (projects.some((p) => !p.category)) catFilters.push(['none', UNCATEGORIZED]);

  if (catFilters.length > 1) {
    const catRow = h(`<div class="tabs" style="margin-bottom:14px"></div>`);
    catFilters.forEach(([v, label]) => {
      const b = h(
        `<button class="tab${state.filterCategory === v ? ' active' : ''}" style="--tab-color:${CAT_COLOR}">${esc(
          label
        )}</button>`
      );
      b.addEventListener('click', () => {
        state.filterCategory = v;
        renderApp();
      });
      catRow.appendChild(b);
    });
    wrap.appendChild(catRow);
  }

  const bar = h(`<div class="newbar"><button class="btn-sm btn-sm-sage" id="bt-new">+ New project</button></div>`);
  on(bar, '#bt-new', 'click', () => openProjectForm(null));
  wrap.appendChild(bar);

  let list = projects.filter((p) => p.status === state.filterStatus);
  if (state.filterCategory === 'none') list = list.filter((p) => !p.category);
  else if (state.filterCategory !== 'all') list = list.filter((p) => p.category === state.filterCategory);

  if (!list.length) {
    const msg = !projects.length
      ? 'No projects yet. Start one, or capture a thought in the Inbox first.'
      : `Nothing ${esc(state.filterStatus)}${
          state.filterCategory !== 'all' && state.filterCategory !== 'none'
            ? ' in ' + esc(state.filterCategory)
            : ''
        }.`;
    const empty = h(`<div class="empty">${msg}</div>`);
    if (!projects.length) {
      const b = h('<button class="btn-empty">+ New project</button>');
      b.addEventListener('click', () => openProjectForm(null));
      empty.appendChild(h('<div style="margin-top:12px"></div>')).appendChild(b);
    }
    wrap.appendChild(empty);
  } else {
    const grid = h('<div class="cards-grid"></div>');
    list.forEach((p) => grid.appendChild(projectCard(p)));
    wrap.appendChild(grid);
  }

  main.replaceChildren(wrap);
}

// "I've got 15 minutes" — open leaf steps that carry a time estimate, across
// Active + Waiting For, shortest first. Steps with no estimate don't appear.
function renderQuickTasks(wrap, review) {
  const caps = [
    [15, '≤ 15m'],
    [30, '≤ 30m'],
    [60, '≤ 1h'],
    [Infinity, 'All'],
  ];
  const capRow = h('<div class="bt-quick-caps"></div>');
  caps.forEach(([v, label]) => {
    const b = h(
      `<button class="bt-quick-cap${state.quickCap === v ? ' active' : ''}">${label}</button>`
    );
    b.addEventListener('click', () => {
      state.quickCap = v;
      renderApp();
    });
    capRow.appendChild(b);
  });
  wrap.appendChild(capRow);

  const rows = [];
  [...(review.active || []), ...(review.waiting || [])].forEach((pr) => {
    withoutContainers(pr.open_steps || []).forEach((st) => {
      if (!st.estimate_minutes) return;
      if (st.estimate_minutes > state.quickCap) return;
      rows.push({ ...st, projectId: pr.id, projectTitle: pr.title });
    });
  });
  rows.sort(
    (a, b) =>
      a.estimate_minutes - b.estimate_minutes ||
      ((a.due_date || '9') < (b.due_date || '9') ? -1 : 1)
  );

  if (!rows.length) {
    wrap.appendChild(
      h(
        `<div class="empty">No estimated steps${
          state.quickCap === Infinity ? '' : ' under that length'
        }. Add a "time needed" to a step and it shows up here.</div>`
      )
    );
    return;
  }

  const list = h('<div class="next-wrap"></div>');
  rows.forEach((r) => {
    const row = h(`
      <div class="next-row" data-step="${r.id}">
        <button class="checkbox" aria-label="Mark done"></button>
        <div class="next-row-main">
          <div class="next-row-title">${esc(r.title)}</div>
          <div class="next-row-sub">${esc(r.projectTitle)} · ~${esc(fmtDuration(r.estimate_minutes))}</div>
        </div>
      </div>
    `);
    row.querySelector('.next-row-main').addEventListener('click', () => openProject(r.projectId));
    row.querySelector('.checkbox').addEventListener('click', async (e) => {
      e.stopPropagation();
      row.classList.add('done');
      try {
        await API.updateStep(r.projectId, r.id, { completed: true });
      } catch {
        row.classList.remove('done');
        toast('Could not update');
        return;
      }
      state.doneThisSession++;
      setTimeout(() => {
        row.remove();
        if (!list.querySelector('.next-row')) renderApp();
      }, 320);
    });
    list.appendChild(row);
  });
  wrap.appendChild(list);
}

// Home "My tasks" — open leaf steps assigned to me across every project.
async function renderMyTasks(wrap) {
  let tasks;
  try {
    ({ tasks } = await guard(() => API.getTasks()));
  } catch {
    return;
  }
  if (!tasks.length) {
    wrap.appendChild(
      h('<div class="empty">Nothing is assigned to you. Steps you\'re given on shared projects show up here.</div>')
    );
    return;
  }
  const list = h('<div class="next-wrap"></div>');
  tasks.forEach((t) => {
    const tail = [t.due_date ? 'due ' + fmtDate(t.due_date) : '', t.estimate_minutes ? '~' + fmtDuration(t.estimate_minutes) : '']
      .filter(Boolean)
      .join(' · ');
    const row = h(`
      <div class="next-row" data-step="${t.id}">
        <button class="checkbox" aria-label="Mark done"></button>
        <div class="next-row-main">
          <div class="next-row-title">${crumb(t.title)}</div>
          <div class="next-row-sub">${esc(t.project_title)}${tail ? ' · ' + esc(tail) : ''}</div>
        </div>
      </div>
    `);
    row.querySelector('.next-row-main').addEventListener('click', () => openProject(t.project_id));
    row.querySelector('.checkbox').addEventListener('click', async (e) => {
      e.stopPropagation();
      row.classList.add('done');
      try {
        await API.updateStep(t.project_id, t.id, { completed: true });
      } catch {
        row.classList.remove('done');
        toast('Could not update');
        return;
      }
      state.doneThisSession++;
      setTimeout(() => {
        row.remove();
        if (!list.querySelector('.next-row')) renderApp();
      }, 320);
    });
    list.appendChild(row);
  });
  wrap.appendChild(list);
}

function projectCard(p) {
  const total = p.step_count || 0;
  const done = p.step_done || 0;
  const estLeft = p.open_estimate_minutes || 0;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const card = h(`
    <div class="card" role="button" tabindex="0">
      <div class="card-top">
        <h3 class="card-title">${esc(p.title)}</h3>
        <span class="status-pill" style="--tab-color:${STATUS_COLOR[p.status]}">${esc(p.status)}</span>
      </div>
      <div class="card-meta">
        ${esc(p.category || UNCATEGORIZED)}
        ${total ? ` · ${done}/${total} steps` : ''}
        ${estLeft ? ` · ~${esc(fmtDuration(estLeft))} left` : ''}
        ${p.deadline ? ` · due ${esc(fmtDate(p.deadline))}` : ''}
        ${p.role !== 'owner' ? ` · ${esc(p.role)}` : ''}
      </div>
      ${
        total
          ? `<div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%;background:${STATUS_COLOR[p.status]}"></div></div>`
          : ''
      }
      ${p.pickup_note ? `<div class="card-footer">${esc(p.pickup_note)}</div>` : ''}
    </div>
  `);
  const open = () => openProject(p.id);
  card.addEventListener('click', open);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  });
  return card;
}

// ── New / edit project form ────────────────────────────────────────────────
// opts: { prefillTitle, onCreate(project) } — onCreate runs after a successful
// create, before navigating to the new project.
async function openProjectForm(existing, opts = {}) {
  const p = existing || (opts.prefillTitle ? { title: opts.prefillTitle } : {});
  await loadCategories();
  const cats = state.categories.map((c) => c.name);
  if (p.category && !cats.includes(p.category)) cats.unshift(p.category);

  const overlay = h(`
    <div class="modal-overlay open">
      <div class="modal">
        <div class="modal-header"><span class="modal-title">${existing ? 'Edit project' : 'New project'}</span>
          <button class="modal-close" aria-label="Close">${icon('close')}</button></div>
        <form id="bt-pform">
          <label class="sp-label">Title</label>
          <input class="sp-input" name="title" required value="${esc(p.title || '')}" />
          <label class="sp-label">Category <button type="button" class="sp-inline-link" id="bt-managecats">manage</button></label>
          <select class="sp-select" name="category">
            <option value="" ${!p.category ? 'selected' : ''}>(none)</option>
            ${cats
              .map((c) => `<option ${p.category === c ? 'selected' : ''}>${esc(c)}</option>`)
              .join('')}
            <option value="__new">＋ New category…</option>
          </select>
          <input class="sp-input" name="newcat" placeholder="New category name" hidden />
          <label class="sp-label">Status</label>
          <select class="sp-select" name="status">
            ${STATUSES.map(
              (s) => `<option ${(p.status || 'Active') === s ? 'selected' : ''}>${s}</option>`
            ).join('')}
          </select>
          <label class="sp-label">Deadline</label>
          <input class="sp-input" type="date" name="deadline" value="${esc(p.deadline || '')}" />
          <label class="sp-label">Description</label>
          <textarea class="sp-input" name="description" rows="2">${esc(p.description || '')}</textarea>
          <label class="sp-label">Project notes</label>
          <textarea class="sp-input" name="pickup_note" rows="3" placeholder="Where you left off, links, reminders…">${esc(
            p.pickup_note || ''
          )}</textarea>
          <div style="display:flex;gap:8px;margin-top:14px">
            <button type="submit" class="btn-sm btn-sm-sage">${existing ? 'Save' : 'Create'}</button>
            <button type="button" class="btn-sm btn-sm-ghost" data-cancel>Cancel</button>
          </div>
          ${
            existing && existing.role === 'owner'
              ? `<div style="display:flex;gap:8px;margin-top:18px">
            <button type="button" class="btn-sm btn-sm-ghost" data-archive>${
              existing.archived_at ? 'Unarchive' : 'Archive'
            }</button>
            <button type="button" class="btn-sm btn-danger" data-delete>Delete project</button>
          </div>`
              : ''
          }
        </form>
      </div>
    </div>
  `);
  const close = () => overlay.remove();
  on(overlay, '[data-delete]', 'click', async () => {
    const ok = await btConfirm(
      `Delete “${existing.title}”? This removes its steps, supplies and timeline. It can't be undone.`,
      { danger: true, ok: 'Delete' }
    );
    if (!ok) return;
    try {
      await guard(() => API.deleteProject(existing.id));
    } catch {
      return;
    }
    close();
    state.view = 'home';
    state.project = null;
    renderApp();
  });
  on(overlay, '[data-archive]', 'click', async () => {
    const archiving = !existing.archived_at;
    if (archiving) {
      const ok = await btConfirm(
        `Archive “${existing.title}”? It leaves your project lists and any board listing is closed. You can bring it back any time.`,
        { ok: 'Archive' }
      );
      if (!ok) return;
    }
    try {
      await guard(() => API.updateProject(existing.id, { archived: archiving }));
    } catch {
      return;
    }
    close();
    if (archiving) {
      state.view = 'home';
      state.project = null;
      renderApp();
    } else {
      openProject(existing.id);
    }
  });
  on(overlay, '.modal-close, [data-cancel]', 'click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  const catSel = overlay.querySelector('select[name=category]');
  const newCat = overlay.querySelector('input[name=newcat]');
  catSel.addEventListener('change', () => {
    newCat.hidden = catSel.value !== '__new';
    if (!newCat.hidden) newCat.focus();
  });
  on(overlay, '#bt-managecats', 'click', () =>
    openManageCategories(() => {
      const keep = catSel.value;
      catSel.innerHTML =
        `<option value="">(none)</option>` +
        state.categories.map((c) => `<option>${esc(c.name)}</option>`).join('') +
        `<option value="__new">＋ New category…</option>`;
      catSel.value = state.categories.some((c) => c.name === keep) ? keep : '';
    })
  );

  on(overlay, '#bt-pform', 'submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);

    let category = f.get('category') || null;
    if (category === '__new') {
      const name = (f.get('newcat') || '').trim();
      if (!name) return toast('Name the new category');
      try {
        category = (await guard(() => API.createCategory(name))).category.name;
      } catch {
        return;
      }
    }

    const body = {
      title: f.get('title').trim(),
      category,
      status: f.get('status'),
      deadline: f.get('deadline') || null,
      description: f.get('description').trim() || null,
      pickup_note: f.get('pickup_note').trim() || null,
    };
    try {
      if (existing) {
        await guard(() => API.updateProject(existing.id, body));
        close();
        openProject(existing.id);
      } else {
        const { project } = await guard(() => API.createProject(body));
        if (opts.onCreate) {
          try {
            await opts.onCreate(project);
          } catch {
            /* non-fatal */
          }
        }
        close();
        openProject(project.id);
      }
    } catch {
      /* toast already shown */
    }
  });
  document.body.appendChild(overlay);
  overlay.querySelector('input[name=title]').focus();
}

// ── Manage categories ─────────────────────────────────────────────────────
function openManageCategories(onDone) {
  const overlay = h(`
    <div class="modal-overlay open">
      <div class="modal">
        <div class="modal-header"><span class="modal-title">Categories</span>
          <button class="modal-close" aria-label="Close">${icon('close')}</button></div>
        <div id="bt-cat-list"></div>
        <div class="person-add">
          <label class="sp-label">Add a category</label>
          <div style="display:flex;gap:8px">
            <input class="sp-input" id="bt-cat-new" placeholder="Name" style="flex:1" />
            <button class="btn-sm btn-sm-sage" id="bt-cat-add">Add</button>
          </div>
        </div>
      </div>
    </div>
  `);
  const close = () => {
    overlay.remove();
    if (onDone) onDone();
  };
  on(overlay, '.modal-close', 'click', close);
  overlay.addEventListener('click', (e) => e.target === overlay && close());

  const listEl = overlay.querySelector('#bt-cat-list');
  const paint = () => {
    listEl.replaceChildren();
    if (!state.categories.length) {
      listEl.appendChild(h('<div class="empty-section">No categories yet.</div>'));
    }
    state.categories.forEach((c) => {
      const row = h(`
        <div class="cat-row">
          <span class="cat-row-name">${esc(c.name)}</span>
          <span class="cat-row-actions">
            <button class="btn-sm btn-sm-ghost" data-rename>Rename</button>
            <button class="btn-sm btn-sm-ghost" data-del>Delete</button>
          </span>
        </div>
      `);
      on(row, '[data-rename]', 'click', async () => {
        const name = await btPrompt('Rename category', c.name);
        if (!name || name === c.name) return;
        await guard(() => API.renameCategory(c.id, name));
        await loadCategories();
        paint();
      });
      on(row, '[data-del]', 'click', async () => {
        const ok = await btConfirm(`Delete “${c.name}”? Projects using it become uncategorized.`, {
          danger: true,
          ok: 'Delete',
        });
        if (!ok) return;
        await guard(() => API.deleteCategory(c.id));
        await loadCategories();
        paint();
      });
      listEl.appendChild(row);
    });
  };

  on(overlay, '#bt-cat-add', 'click', async () => {
    const inp = overlay.querySelector('#bt-cat-new');
    const name = inp.value.trim();
    if (!name) return;
    try {
      await guard(() => API.createCategory(name));
    } catch {
      return;
    }
    inp.value = '';
    await loadCategories();
    paint();
  });

  document.body.appendChild(overlay);
  paint();
}

// ── People / sharing ──────────────────────────────────────────────────────
const ROLE_RANK = { viewer: 1, editor: 2, owner: 3 };

async function openPeople(bundle) {
  const projectId = bundle.project.id;
  const myRole = bundle.project.role;
  const isOwner = myRole === 'owner';

  const overlay = h(`
    <div class="modal-overlay open">
      <div class="modal">
        <div class="modal-header"><span class="modal-title">People</span>
          <button class="modal-close" aria-label="Close">${icon('close')}</button></div>
        <div id="bt-people-body"><div class="empty">Loading…</div></div>
      </div>
    </div>
  `);
  const close = () => overlay.remove();
  on(overlay, '.modal-close', 'click', close);
  overlay.addEventListener('click', (e) => e.target === overlay && close());
  document.body.appendChild(overlay);

  const body = overlay.querySelector('#bt-people-body');

  async function refresh() {
    let data;
    try {
      data = await guard(() => API.collaborators(projectId));
    } catch {
      close();
      return;
    }
    paint(data.collaborators || [], data.invites || []);
  }

  function paint(collabs, invites) {
    collabs.sort((a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role]);
    const meId = state.user.id;

    const rows = collabs
      .map((c) => {
        const me = c.user_id === meId;
        const name = esc(c.name || c.email);
        if (c.role === 'owner') {
          return `<div class="person"><div><div class="person-name">${name}${me ? ' (you)' : ''}</div>
            <div class="person-sub">${esc(c.email)} · owner</div></div></div>`;
        }
        if (!isOwner) {
          return `<div class="person"><div><div class="person-name">${name}${me ? ' (you)' : ''}</div>
            <div class="person-sub">${esc(c.email)} · ${esc(c.role)}</div></div></div>`;
        }
        return `<div class="person" data-uid="${c.user_id}">
          <div><div class="person-name">${name}</div><div class="person-sub">${esc(c.email)}</div></div>
          <div class="person-actions">
            <select class="sp-select person-role" style="width:auto;margin:0">
              <option value="editor" ${c.role === 'editor' ? 'selected' : ''}>editor</option>
              <option value="viewer" ${c.role === 'viewer' ? 'selected' : ''}>viewer</option>
            </select>
            <button class="btn-sm btn-sm-ghost" data-makeowner>Make owner</button>
            <button class="btn-sm btn-sm-ghost" data-remove>Remove</button>
          </div>
        </div>`;
      })
      .join('');

    const inviteRows = invites.length
      ? `<div class="person-group">Pending invites</div>` +
        invites
          .map(
            (i) =>
              `<div class="person"><div><div class="person-name">${esc(i.email)}</div>
              <div class="person-sub">invited as ${esc(i.role)} · joins when they sign in</div></div></div>`
          )
          .join('')
      : '';

    body.replaceChildren(
      h(`
      <div>
        <div class="person-list">${rows}${inviteRows}</div>
        ${
          isOwner
            ? `<div class="person-add">
                <label class="sp-label">Add someone</label>
                <input class="sp-input" id="bt-add-q" placeholder="Name or email" />
                <div id="bt-add-matches"></div>
                <div style="display:flex;gap:8px;align-items:center;margin-top:8px">
                  <select class="sp-select" id="bt-add-role" style="width:auto;margin:0">
                    <option value="editor">editor</option>
                    <option value="viewer">viewer</option>
                  </select>
                  <button class="btn-sm btn-sm-sage" id="bt-add-go">Add</button>
                </div>
                <div class="person-sub" style="margin-top:6px">Type an email to invite someone without an account.</div>
              </div>`
            : ''
        }
      </div>
    `)
    );

    if (!isOwner) return;

    body.querySelectorAll('.person[data-uid]').forEach((row) => {
      const uid = row.dataset.uid;
      on(row, '.person-role', 'change', async (e) => {
        await guard(() => API.setCollaboratorRole(projectId, uid, e.target.value));
        toast('Role updated');
      });
      on(row, '[data-remove]', 'click', async () => {
        await guard(() => API.removeCollaborator(projectId, uid));
        refresh();
      });
      on(row, '[data-makeowner]', 'click', async () => {
        const name = row.querySelector('.person-name').textContent;
        if (!(await btConfirm(`Make ${name} the owner? You'll become an editor.`, { ok: 'Transfer' })))
          return;
        await guard(() => API.transferProject(projectId, uid));
        close();
        openProject(projectId); // reload — my role changed
      });
    });

    const q = body.querySelector('#bt-add-q');
    const matches = body.querySelector('#bt-add-matches');
    const go = body.querySelector('#bt-add-go');

    // "People you follow" — a shortcut list shown while the search box is empty.
    const followsBox = h('<div id="bt-add-follows"></div>');
    matches.after(followsBox);
    const collabIds = new Set(collabs.map((c) => c.user_id));
    (async () => {
      let following = [];
      try {
        following = (await API.listFollowing()).users || [];
      } catch {
        return;
      }
      following = following.filter((u) => !collabIds.has(u.id));
      if (!following.length) return;
      followsBox.appendChild(
        h('<div class="person-sub" style="margin-top:10px">People you follow</div>')
      );
      following.forEach((u) => {
        const btn = h(
          `<button class="btn-sm btn-sm-ghost bt-add-follow" style="display:block;width:100%;text-align:left;margin-top:4px">${esc(
            u.display_name || u.name || '@' + u.handle
          )} <span style="color:var(--text-muted)">@${esc(u.handle)}</span></button>`
        );
        btn.addEventListener('click', () => add({ userId: u.id }));
        followsBox.appendChild(btn);
      });
    })();

    let timer;
    q.addEventListener('input', () => {
      clearTimeout(timer);
      const term = q.value.trim();
      matches.replaceChildren();
      followsBox.hidden = !!term;
      if (term.length < 2 || term.includes('@')) return;
      timer = setTimeout(async () => {
        let users = [];
        try {
          users = (await API.searchUsers(term)).users || [];
        } catch {
          return;
        }
        matches.replaceChildren(
          ...users.map((u) => {
            const btn = h(
              `<button class="btn-sm btn-sm-ghost" style="display:block;width:100%;text-align:left;margin-top:4px">${esc(
                u.name || '(unnamed)'
              )}</button>`
            );
            btn.addEventListener('click', () => add({ userId: u.id }));
            return btn;
          })
        );
      }, 250);
    });

    async function add(who) {
      const role = body.querySelector('#bt-add-role').value;
      try {
        await guard(() => API.addCollaborator(projectId, { ...who, role }));
      } catch {
        return;
      }
      q.value = '';
      matches.replaceChildren();
      refresh();
    }

    go.addEventListener('click', () => {
      const term = q.value.trim();
      if (!term) return;
      if (term.includes('@')) add({ email: term });
      else toast('Pick a person from the list, or type their email');
    });
  }

  refresh();
}

// ── Project detail ─────────────────────────────────────────────────────────
async function openProject(id) {
  state.view = 'project';
  state.project = null;
  state.detailTab = 'steps';
  renderApp();
  try {
    state.project = await guard(() => API.getProject(id));
  } catch {
    state.view = 'home';
    renderApp();
    return;
  }
  renderApp();
}

function renderProject(app) {
  app.replaceChildren();
  const b = state.project;
  if (!b) {
    app.appendChild(h('<div class="detail-body"><div class="empty">Loading…</div></div>'));
    return;
  }
  const p = b.project;
  const canEdit = p.role === 'owner' || p.role === 'editor';
  // Progress counts leaf steps only — a container's state is derived from them.
  const leaves = b.steps.filter((s) => !b.steps.some((o) => o.parent_step_id === s.id));
  const done = leaves.filter((s) => s.completed).length;
  const pct = leaves.length ? Math.round((done / leaves.length) * 100) : 0;

  const view = h(`
    <div>
      <div class="detail-strip" style="background:${STATUS_COLOR[p.status]}"></div>
      <div class="detail-body">
        <div class="detail-topbar">
          <button class="detail-back" id="bt-back">← Back</button>
          <button class="detail-back" id="bt-printproj">Print</button>
          <button class="detail-back" id="bt-dupproj">Duplicate</button>
          ${canEdit ? '<button class="detail-back" id="bt-editproj">Edit</button>' : ''}
        </div>
        <h1 class="detail-title">${esc(p.title)}</h1>
        <div class="detail-meta">
          <span class="status-pill" style="--tab-color:${STATUS_COLOR[p.status]}">${esc(p.status)}</span>
          ${p.category ? `<span>${esc(p.category)}</span>` : ''}
          ${p.deadline ? `<span>due ${esc(fmtDate(p.deadline))}</span>` : ''}
          <button class="meta-people" id="bt-people">${icon('people', 16)} ${b.collaborators.length}${
            p.role !== 'owner' ? ` &middot; ${esc(p.role)}` : ''
          }</button>
          ${
            b.listing
              ? `<button class="meta-people" id="bt-board-listing">${icon(
                  'people',
                  16
                )} On the board${b.listing.status !== 'open' ? ` &middot; ${esc(b.listing.status)}` : ''}</button>`
              : p.role === 'owner'
                ? `<button class="meta-people" id="bt-board-list">${icon('people', 16)} List on the board</button>`
                : ''
          }
        </div>
        ${p.description ? `<p style="color:var(--text-muted);font-size:16px;line-height:1.55;margin-bottom:14px">${esc(p.description)}</p>` : ''}
        <div class="pickup-box" id="bt-pickup-box"></div>
        ${
          leaves.length
            ? `<div class="progress-bar-wrap" style="margin:14px 0"><div class="progress-bar-fill" style="width:${pct}%;background:${STATUS_COLOR[p.status]}"></div></div>`
            : ''
        }
        <button class="focus-detail-btn" id="bt-focus">${icon('candle')} Start a focus session</button>
        <div id="bt-sessions-slot"></div>
        <div class="detail-tabs">
          ${['steps', 'supplies', 'links', 'timeline']
            .map(
              (t) =>
                `<button class="detail-tab${state.detailTab === t ? ' active' : ''}" data-tab="${t}">${
                  t[0].toUpperCase() + t.slice(1)
                }</button>`
            )
            .join('')}
        </div>
        <div id="bt-panel"></div>
      </div>
    </div>
  `);

  on(view, '#bt-back', 'click', () => {
    state.view = 'home';
    state.project = null;
    renderApp();
  });
  on(view, '#bt-focus', 'click', () => openFocusSession(state.project));
  on(view, '#bt-people', 'click', () => openPeople(state.project));
  on(view, '#bt-board-listing', 'click', () => b.listing && openListing(b.listing.id));
  on(view, '#bt-board-list', 'click', () =>
    openListingForm(p.id, null, (id) => openListing(id))
  );
  if (canEdit) on(view, '#bt-editproj', 'click', () => openProjectForm(p));
  view.querySelector('#bt-sessions-slot').appendChild(sessionsBlock(b));
  on(view, '#bt-printproj', 'click', () => window.open('/api/projects/' + p.id + '/print', '_blank'));
  on(view, '#bt-dupproj', 'click', async () => {
    const ok = await btConfirm(
      `Duplicate “${p.title}”? Its steps, supplies and links copy into a new project you own — the timeline and collaborators don't come along.`,
      { ok: 'Duplicate' }
    );
    if (!ok) return;
    let res;
    try {
      res = await guard(() => API.duplicateProject(p.id));
    } catch {
      return;
    }
    toast('Project duplicated');
    openProject(res.id);
  });
  renderPickup(view.querySelector('#bt-pickup-box'), canEdit);
  on(view, '[data-tab]', 'click', (e) => {
    state.detailTab = e.currentTarget.dataset.tab;
    view
      .querySelectorAll('.detail-tab')
      .forEach((t) => t.classList.toggle('active', t.dataset.tab === state.detailTab));
    renderPanel(view.querySelector('#bt-panel'));
  });

  app.appendChild(view);
  renderPanel(view.querySelector('#bt-panel'));
}

function renderPanel(panel) {
  const b = state.project;
  const p = b.project;
  const canEdit = p.role === 'owner' || p.role === 'editor';
  panel.replaceChildren();

  if (state.detailTab === 'steps') panel.appendChild(stepsPanel(b, canEdit));
  else if (state.detailTab === 'supplies') panel.appendChild(suppliesPanel(b, canEdit));
  else if (state.detailTab === 'links') panel.appendChild(linksPanel(b, canEdit));
  else panel.appendChild(timelinePanel(b, canEdit));
}

// Refetch the project bundle and rebuild the open panel (header counts included).
async function refreshDetail() {
  try {
    state.project = await guard(() => API.getProject(state.project.project.id));
  } catch {
    return;
  }
  const panel = document.getElementById('bt-panel');
  if (panel) renderPanel(panel);
}

// "Project notes" — a freeform scratch area for the project, editable inline.
// Stored in projects.pickup_note (column kept; only the label changed).
function renderPickup(box, canEdit) {
  const p = state.project.project;
  const show = () => {
    box.replaceChildren(
      h(`
      <div>
        <div class="pickup-label">Project notes${canEdit ? ' <span class="pickup-edit-hint">edit</span>' : ''}</div>
        <div class="pickup-text">${
          p.pickup_note ? esc(p.pickup_note) : '<span style="color:var(--text-faint)">No notes yet — tap to add</span>'
        }</div>
      </div>
    `)
    );
    if (canEdit) box.querySelector('.pickup-text').addEventListener('click', edit);
    if (canEdit) box.querySelector('.pickup-edit-hint').addEventListener('click', edit);
  };
  const edit = () => {
    box.replaceChildren(
      h(`
      <div>
        <div class="pickup-label">Project notes</div>
        <textarea class="pickup-input" rows="4">${esc(p.pickup_note || '')}</textarea>
        <div class="pickup-edit-actions">
          <button class="btn-sm btn-sm-sage" data-save>Save</button>
          <button class="btn-sm btn-sm-ghost" data-cancel>Cancel</button>
        </div>
      </div>
    `)
    );
    const ta = box.querySelector('.pickup-input');
    ta.focus();
    on(box, '[data-cancel]', 'click', show);
    on(box, '[data-save]', 'click', async () => {
      const note = ta.value.trim() || null;
      try {
        await guard(() => API.updateProject(p.id, { pickup_note: note }));
      } catch {
        return;
      }
      p.pickup_note = note;
      show();
    });
  };
  show();
}

function sectionHeader(label, count, onAdd) {
  const el = h(`
    <div class="section-header">
      <span class="section-label">${label}${count != null ? ` <span class="section-count">${count}</span>` : ''}</span>
      ${onAdd ? '<button class="btn-section-add" aria-label="Add">+</button>' : ''}
    </div>
  `);
  if (onAdd) on(el, '.btn-section-add', 'click', onAdd);
  return el;
}

// steps
function stepsPanel(b, canEdit) {
  const wrap = h('<div class="detail-panel"></div>');
  const rerender = refreshDetail;
  const tree = stepTree(b.steps);
  let open = tree.top.filter((s) => !s.completed);
  const done = tree.top.filter((s) => s.completed);

  const multiPerson = (b.collaborators || []).length > 1;
  if (multiPerson) {
    const af = state.stepFilterAssignee || 'all';
    const wanted = af === 'me' ? state.me.user.id : af;
    if (af !== 'all') {
      const hit = (st) => st.assignee_id === wanted;
      open = open.filter((s) => hit(s) || tree.kidsOf(s.id).some(hit));
    }
    wrap.appendChild(assigneeFilterRow(b));
  }

  wrap.appendChild(
    sectionHeader('Steps', open.length, canEdit ? () => openStepForm(b, null, rerender) : null)
  );

  const listEl = h('<div></div>');
  if (!b.steps.length) {
    listEl.appendChild(
      h(`<div class="empty-section">${canEdit ? 'No steps yet — add the first one.' : 'No steps yet.'}</div>`)
    );
  } else if (!open.length && multiPerson && state.stepFilterAssignee !== 'all') {
    listEl.appendChild(h('<div class="empty-section">No open steps for that person.</div>'));
  }
  open.forEach((s) => listEl.appendChild(stepBlock(b, s, tree, canEdit, rerender)));
  wrap.appendChild(listEl);

  if (canEdit) wrap.appendChild(quickAddRow(b, rerender));

  if (done.length) {
    const toggle = h(`<button class="done-toggle">Completed (${done.length})</button>`);
    const doneList = h('<div hidden></div>');
    done.forEach((s) => doneList.appendChild(stepBlock(b, s, tree, canEdit, rerender)));
    toggle.addEventListener('click', () => {
      doneList.hidden = !doneList.hidden;
      toggle.classList.toggle('open', !doneList.hidden);
    });
    wrap.appendChild(toggle);
    wrap.appendChild(doneList);
  }
  return wrap;
}

// "Everyone · Me · <name>…" — narrows the step list by assignee. Shown only on
// projects with more than one collaborator.
function assigneeFilterRow(b) {
  const cur = state.stepFilterAssignee || 'all';
  const opts = [
    ['all', 'Everyone'],
    ['me', 'Me'],
    ...(b.collaborators || [])
      .filter((c) => c.user_id !== state.me.user.id)
      .map((c) => [c.user_id, c.name || (c.email ? c.email.split('@')[0] : '@?')]),
  ];
  const rowEl = h('<div class="tabs bt-assignee-filter" style="margin-bottom:10px"></div>');
  opts.forEach(([v, label]) => {
    const bn = h(`<button class="tab${cur === v ? ' active' : ''}">${esc(label)}</button>`);
    bn.addEventListener('click', () => {
      state.stepFilterAssignee = v;
      const panel = document.getElementById('bt-panel');
      if (panel) renderPanel(panel);
    });
    rowEl.appendChild(bn);
  });
  return rowEl;
}

// A top-level step plus, if it's a container, its sub-steps indented beneath.
function stepBlock(b, s, tree, canEdit, rerender) {
  const kids = tree.kidsOf(s.id);
  const block = h('<div class="step-block"></div>');
  block.appendChild(stepRow(b, s, canEdit, rerender, { kids }));
  if (kids.length) {
    const sub = h('<div class="substeps"></div>');
    kids.forEach((k) => sub.appendChild(stepRow(b, k, canEdit, rerender, { isChild: true })));
    block.appendChild(sub);
  }
  return block;
}

function stepRow(b, s, canEdit, rerender, opts = {}) {
  const { kids = [], isChild = false } = opts;
  const isContainer = kids.length > 0;
  const shownEst = isContainer
    ? kids.reduce((n, k) => n + (k.estimate_minutes || 0), 0)
    : s.estimate_minutes || 0;

  const bits = [];
  if (s.due_date) bits.push('due ' + esc(fmtDate(s.due_date)));
  if (isContainer) bits.push(`${kids.filter((k) => k.completed).length}/${kids.length} done`);
  if (shownEst) bits.push((isContainer ? '≈ ' : '~') + esc(fmtDuration(shownEst)));
  if (!isContainer && s.notes) bits.push(esc(s.notes));

  const boxDisabled = !canEdit || isContainer;
  const showBash = canEdit && !isChild;
  const multiPerson = (b.collaborators || []).length > 1;
  const assigneeNm = s.assignee_id ? collabName(b, s.assignee_id) : null;
  const showAssignee = multiPerson || !!s.assignee_id;
  const assigneeHtml = !showAssignee
    ? ''
    : assigneeNm
      ? `<button class="step-assignee" title="Assigned to ${esc(assigneeNm)}" aria-label="Assigned to ${esc(
          assigneeNm
        )}">${avatarEl(assigneeNm)}</button>`
      : canEdit
        ? `<button class="step-assignee step-assignee-empty" title="Assign" aria-label="Assign this step">+</button>`
        : '';
  const row = h(`
    <div class="check-row${s.completed ? ' checked' : ''}${isChild ? ' is-child' : ''}${
      isContainer ? ' is-container' : ''
    }">
      <button class="checkbox" ${s.completed ? 'aria-checked="true"' : ''} ${
        boxDisabled ? 'disabled' : ''
      }>${s.completed ? icon('check', 18) : ''}</button>
      <div class="check-content${canEdit ? ' tappable' : ''}">
        <div class="check-title">${esc(s.title)}</div>
        ${bits.length ? `<div class="check-sub">${bits.join(' · ')}</div>` : ''}
      </div>
      ${assigneeHtml}
      ${
        showBash
          ? `<button class="step-bash" title="${
              isContainer ? 'Add sub-steps' : 'Break into steps'
            }" aria-label="Break into steps">${icon('steps', 18)}</button>`
          : ''
      }
    </div>
  `);
  if (canEdit) {
    if (!isContainer) {
      on(row, '.checkbox', 'click', async (e) => {
        e.stopPropagation();
        await guard(() => API.updateStep(b.project.id, s.id, { completed: !s.completed }));
        rerender();
      });
    }
    on(row, '.check-content', 'click', () => openStepForm(b, s, rerender, { isContainer }));
    on(row, '.step-assignee', 'click', (e) => {
      e.stopPropagation();
      openAssigneeMenu(e.currentTarget, b, s, rerender);
    });
    if (showBash) {
      on(row, '.step-bash', 'click', (e) => {
        e.stopPropagation();
        openBashForm(b, s, rerender, { existing: isContainer });
      });
    }
  }
  return row;
}

// Persistent inline add at the foot of the step list. Enter adds a step and
// keeps focus; a pasted multi-line value adds one step per line.
function quickAddRow(b, done) {
  const form = h(`
    <form class="bt-quickadd">
      <textarea class="bt-quickadd-input" rows="1" placeholder="+ add a step" aria-label="Add a step"></textarea>
    </form>
  `);
  const input = form.querySelector('textarea');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const lines = input.value.split('\n').map((t) => t.trim()).filter(Boolean);
    if (!lines.length) return;
    input.disabled = true;
    try {
      for (const line of lines) await guard(() => API.addStep(b.project.id, { title: line }));
    } catch {
      input.disabled = false;
      return;
    }
    input.value = '';
    input.disabled = false;
    await done();
    const next = document.querySelector('.bt-quickadd-input');
    if (next) next.focus();
  });
  return form;
}

// ISO date N days from today; weekend = the coming Saturday (today if Saturday).
function isoInDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function isoWeekend() {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  return d.toISOString().slice(0, 10);
}

function openStepForm(b, existing, done, opts = {}) {
  const s = existing || {};
  const isContainer = !!opts.isContainer;
  const estIdx = s.estimate_minutes ? STEP_ESTIMATES.indexOf(s.estimate_minutes) + 1 : 0;
  const overlay = h(`
    <div class="modal-overlay open">
      <div class="modal">
        <div class="modal-header"><span class="modal-title">${existing ? 'Edit step' : 'Add step'}</span>
          <button class="modal-close" aria-label="Close">${icon('close')}</button></div>
        <form id="bt-sform">
          <label class="sp-label">Step</label>
          <input class="sp-input" name="title" required value="${esc(s.title || '')}" />
          <label class="sp-label">Due date</label>
          <div class="bt-date-chips">
            <button type="button" class="bt-chip" data-days="0">Today</button>
            <button type="button" class="bt-chip" data-days="1">Tomorrow</button>
            <button type="button" class="bt-chip" data-weekend>This weekend</button>
            <button type="button" class="bt-chip" data-days="7">Next week</button>
            <button type="button" class="bt-chip bt-chip-clear" data-clear>Clear</button>
          </div>
          <input class="sp-input" type="date" name="due_date" value="${esc(s.due_date || '')}" />
          <label class="sp-label">Notes</label>
          <textarea class="sp-input" name="notes" rows="2">${esc(s.notes || '')}</textarea>
          ${
            isContainer
              ? ''
              : `<label class="sp-label">Time needed</label>
          <div class="bt-est">
            <input type="range" class="bt-est-slider" min="0" max="7" step="1" value="${estIdx}" />
            <span class="bt-est-label"></span>
          </div>`
          }
          <div style="display:flex;gap:8px;margin-top:14px">
            <button type="submit" class="btn-sm btn-sm-sage">${existing ? 'Save' : 'Add'}</button>
            ${existing ? '<button type="button" class="btn-sm btn-sm-ghost" data-del>Delete</button>' : ''}
            <button type="button" class="btn-sm btn-sm-ghost" data-cancel>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `);
  const close = () => overlay.remove();
  const dateInput = overlay.querySelector('input[name=due_date]');
  on(overlay, '.bt-chip[data-days]', 'click', (e) => {
    dateInput.value = isoInDays(Number(e.currentTarget.dataset.days));
  });
  on(overlay, '.bt-chip[data-weekend]', 'click', () => {
    dateInput.value = isoWeekend();
  });
  on(overlay, '.bt-chip[data-clear]', 'click', () => {
    dateInput.value = '';
  });

  const slider = overlay.querySelector('.bt-est-slider');
  if (slider) {
    const label = overlay.querySelector('.bt-est-label');
    const sync = () => (label.textContent = STEP_ESTIMATE_LABELS[Number(slider.value)]);
    slider.addEventListener('input', sync);
    sync();
  }

  on(overlay, '.modal-close, [data-cancel]', 'click', close);
  overlay.addEventListener('click', (e) => e.target === overlay && close());
  on(overlay, '[data-del]', 'click', async () => {
    const msg = isContainer
      ? `Delete “${s.title}” and all its sub-steps?`
      : `Delete “${s.title}”?`;
    if (!(await btConfirm(msg, { danger: true, ok: 'Delete' }))) return;
    await guard(() => API.deleteStep(b.project.id, existing.id));
    close();
    done();
  });
  on(overlay, '#bt-sform', 'submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const body = {
      title: f.get('title').trim(),
      due_date: f.get('due_date') || null,
      notes: f.get('notes').trim() || null,
    };
    if (!isContainer) {
      const idx = slider ? Number(slider.value) : 0;
      body.estimate_minutes = idx > 0 ? STEP_ESTIMATES[idx - 1] : null;
    }
    if (existing) await guard(() => API.updateStep(b.project.id, existing.id, body));
    else await guard(() => API.addStep(b.project.id, body));
    close();
    done();
  });
  document.body.appendChild(overlay);
  overlay.querySelector('input[name=title]').focus();
}

// Break a step into sub-steps (or add more to an existing container).
function openBashForm(b, step, done, opts = {}) {
  const adding = !!opts.existing;
  const overlay = h(`
    <div class="modal-overlay open">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">${adding ? 'Add sub-steps' : 'Break into steps'}</span>
          <button class="modal-close" aria-label="Close">${icon('close')}</button>
        </div>
        <form id="bt-bashform">
          <p class="bt-bash-parent">${esc(step.title)}</p>
          <label class="sp-label">One sub-step per line</label>
          <textarea class="sp-input" name="titles" rows="5" placeholder="cut out pieces&#10;decide on pattern&#10;sew the seams"></textarea>
          <div style="display:flex;gap:8px;margin-top:14px">
            <button type="submit" class="btn-sm btn-sm-sage">${adding ? 'Add' : 'Break it up'}</button>
            <button type="button" class="btn-sm btn-sm-ghost" data-cancel>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `);
  const close = () => overlay.remove();
  on(overlay, '.modal-close, [data-cancel]', 'click', close);
  overlay.addEventListener('click', (e) => e.target === overlay && close());
  on(overlay, '#bt-bashform', 'submit', async (e) => {
    e.preventDefault();
    const titles = new FormData(e.target)
      .get('titles')
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean);
    if (!titles.length) {
      toast('Add at least one line');
      return;
    }
    await guard(() => API.bashStep(b.project.id, step.id, titles));
    close();
    done();
  });
  document.body.appendChild(overlay);
  overlay.querySelector('textarea').focus();
}

// supplies
function suppliesPanel(b, canEdit) {
  const wrap = h('<div class="detail-panel"></div>');
  const listEl = h('<div></div>');
  const rerender = refreshDetail;
  const fill = () => {
    listEl.replaceChildren();
    if (!b.supplies.length) listEl.appendChild(h('<div class="empty-section">No supplies yet.</div>'));
    b.supplies.forEach((s) => listEl.appendChild(supplyRow(b, s, canEdit, rerender)));
  };
  wrap.appendChild(
    sectionHeader(
      'Supplies',
      b.supplies.length,
      canEdit ? () => openSupplyForm(b, null, rerender) : null
    )
  );
  wrap.appendChild(listEl);
  fill();
  return wrap;
}

function supplyRow(b, s, canEdit, rerender) {
  const bits = [];
  if (s.cost != null) bits.push('$' + Number(s.cost).toFixed(2));
  if (s.source) bits.push(esc(s.source));
  const row = h(`
    <div class="check-row${s.acquired ? ' checked' : ''}">
      <button class="checkbox" ${s.acquired ? 'aria-checked="true"' : ''} ${canEdit ? '' : 'disabled'}>${
        s.acquired ? icon('check', 16) : ''
      }</button>
      <div class="check-content${canEdit ? ' tappable' : ''}">
        <div class="check-title">${esc(s.name)}</div>
        ${bits.length || s.url ? `<div class="check-sub">${bits.join(' · ')}${
          s.url ? ` · <a href="${esc(s.url)}" target="_blank" rel="noopener">link</a>` : ''
        }</div>` : ''}
      </div>
    </div>
  `);
  if (canEdit) {
    on(row, '.checkbox', 'click', async () => {
      await guard(() => API.updateSupply(b.project.id, s.id, { acquired: !s.acquired }));
      rerender();
    });
    on(row, '.check-content', 'click', (e) => {
      if (e.target.tagName === 'A') return; // let the link work
      openSupplyForm(b, s, rerender);
    });
  }
  return row;
}

function openSupplyForm(b, existing, done) {
  const s = existing || {};
  const overlay = h(`
    <div class="modal-overlay open">
      <div class="modal">
        <div class="modal-header"><span class="modal-title">${existing ? 'Edit supply' : 'Add supply'}</span>
          <button class="modal-close" aria-label="Close">${icon('close')}</button></div>
        <form id="bt-supform">
          <label class="sp-label">Item</label>
          <input class="sp-input" name="name" required value="${esc(s.name || '')}" />
          <label class="sp-label">Est. cost</label>
          <input class="sp-input" type="number" step="0.01" min="0" name="cost" value="${
            s.cost != null ? esc(s.cost) : ''
          }" />
          <label class="sp-label">Source</label>
          <input class="sp-input" name="source" value="${esc(s.source || '')}" placeholder="Store or maker" />
          <label class="sp-label">Link</label>
          <input class="sp-input" type="url" name="url" value="${esc(s.url || '')}" />
          <label style="display:flex;gap:8px;align-items:center;margin:10px 0;font-size:16px">
            <input type="checkbox" name="acquired" ${s.acquired ? 'checked' : ''} /> Have it
          </label>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button type="submit" class="btn-sm btn-sm-sage">${existing ? 'Save' : 'Add'}</button>
            ${existing ? '<button type="button" class="btn-sm btn-sm-ghost" data-del>Delete</button>' : ''}
            <button type="button" class="btn-sm btn-sm-ghost" data-cancel>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `);
  const close = () => overlay.remove();
  on(overlay, '.modal-close, [data-cancel]', 'click', close);
  overlay.addEventListener('click', (e) => e.target === overlay && close());
  on(overlay, '[data-del]', 'click', async () => {
    await guard(() => API.deleteSupply(b.project.id, existing.id));
    close();
    done();
  });
  on(overlay, '#bt-supform', 'submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const body = {
      name: f.get('name').trim(),
      cost: f.get('cost') ? Number(f.get('cost')) : null,
      source: f.get('source').trim() || null,
      url: f.get('url').trim() || null,
      acquired: f.get('acquired') === 'on',
    };
    if (existing) await guard(() => API.updateSupply(b.project.id, existing.id, body));
    else await guard(() => API.addSupply(b.project.id, body));
    close();
    done();
  });
  document.body.appendChild(overlay);
  overlay.querySelector('input[name=name]').focus();
}

// links
function linksPanel(b, canEdit) {
  const wrap = h('<div class="detail-panel"></div>');
  const listEl = h('<div></div>');
  const rerender = refreshDetail;
  const fill = () => {
    listEl.replaceChildren();
    if (!b.links.length) {
      listEl.appendChild(h('<div class="empty-section">No links yet.</div>'));
    } else {
      b.links.forEach((l) => listEl.appendChild(linkRow(b, l, canEdit, rerender)));
    }
    if (canEdit) listEl.appendChild(linkAddRow(b, rerender));
  };
  wrap.appendChild(
    sectionHeader('Links', b.links.length, canEdit ? () => openLinkForm(b, null, rerender) : null)
  );
  wrap.appendChild(listEl);
  fill();
  return wrap;
}

function linkRow(b, l, canEdit, rerender) {
  const label = l.title || linkHost(l.url);
  // Sub-line: the note if there is one; otherwise the hostname, but only when
  // the label isn't already the hostname (an untitled link needs nothing more).
  const sub = l.note || (l.title ? linkHost(l.url) : '');
  const row = h(`
    <div class="check-row link-row">
      <span class="link-ic">${icon('link', 18)}</span>
      <div class="check-content">
        <a class="check-title link-title" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>
        ${sub ? `<div class="check-sub">${esc(sub)}</div>` : ''}
      </div>
      ${canEdit ? `<button class="link-edit" aria-label="Edit link">${icon('chevron', 16)}</button>` : ''}
    </div>
  `);
  if (canEdit) on(row, '.link-edit', 'click', () => openLinkForm(b, l, rerender));
  return row;
}

// Persistent "paste a URL" row at the foot of the list — no modal for the
// common case. A pasted title is optional; Enter or the button adds it.
function linkAddRow(b, done) {
  const row = h(`
    <form class="bt-quickadd link-add">
      <input class="bt-quickadd-input link-add-url" type="url" inputmode="url"
        placeholder="Paste a link…" aria-label="Link URL" />
    </form>
  `);
  on(row, 'form', 'submit', async (e) => {
    e.preventDefault();
    const url = row.querySelector('.link-add-url').value.trim();
    if (!url) return;
    await guard(() => API.addLink(b.project.id, { url }));
    done();
  });
  return row;
}

function openLinkForm(b, existing, done) {
  const l = existing || {};
  const overlay = h(`
    <div class="modal-overlay open">
      <div class="modal">
        <div class="modal-header"><span class="modal-title">${existing ? 'Edit link' : 'Add link'}</span>
          <button class="modal-close" aria-label="Close">${icon('close')}</button></div>
        <form id="bt-linkform">
          <label class="sp-label">Link</label>
          <input class="sp-input" name="url" type="url" inputmode="url" required
            placeholder="https://…" value="${esc(l.url || '')}" />
          <label class="sp-label">Title</label>
          <input class="sp-input" name="title" value="${esc(l.title || '')}"
            placeholder="Optional — shows the site name if blank" />
          <label class="sp-label">Note</label>
          <textarea class="sp-input" name="note" rows="2" placeholder="Optional — why this matters">${esc(l.note || '')}</textarea>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button type="submit" class="btn-sm btn-sm-sage">${existing ? 'Save' : 'Add'}</button>
            ${existing ? '<button type="button" class="btn-sm btn-sm-ghost" data-del>Delete</button>' : ''}
            <button type="button" class="btn-sm btn-sm-ghost" data-cancel>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `);
  const close = () => overlay.remove();
  on(overlay, '.modal-close, [data-cancel]', 'click', close);
  overlay.addEventListener('click', (e) => e.target === overlay && close());
  on(overlay, '[data-del]', 'click', async () => {
    await guard(() => API.deleteLink(b.project.id, existing.id));
    close();
    done();
  });
  on(overlay, '#bt-linkform', 'submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const body = {
      url: f.get('url').trim(),
      title: f.get('title').trim() || null,
      note: f.get('note').trim() || null,
    };
    if (existing) await guard(() => API.updateLink(b.project.id, existing.id, body));
    else await guard(() => API.addLink(b.project.id, body));
    close();
    done();
  });
  document.body.appendChild(overlay);
  overlay.querySelector('input[name=url]').focus();
}

// timeline / journal
function timelinePanel(b, canEdit) {
  const wrap = h('<div class="detail-panel"></div>');
  wrap.appendChild(h('<div class="section-header"><span class="section-label">Timeline</span></div>'));

  if (canEdit) {
    const form = h(`
      <div class="journal-add-form">
        <textarea id="bt-journal" rows="2" placeholder="What's going on with this project?"></textarea>
        <div style="margin-top:8px"><button class="btn-sm btn-sm-amethyst" id="bt-journal-add">Add note</button></div>
      </div>
    `);
    on(form, '#bt-journal-add', 'click', async () => {
      const ta = form.querySelector('#bt-journal');
      const text = ta.value.trim();
      if (!text) return;
      await guard(() => API.addJournal(b.project.id, text));
      refreshDetail();
    });
    wrap.appendChild(form);
  }

  if (!b.journal.length) {
    wrap.appendChild(h('<div class="empty-section">No entries yet.</div>'));
  } else {
    b.journal.forEach((j) => {
      wrap.appendChild(
        h(`
        <div class="due-row" style="align-items:flex-start">
          <div class="due-row-content">
            <div class="due-row-sub">${esc(j.author_name || '')} · ${esc(timeAgo(j.created_at))}</div>
            <div class="due-row-title" style="white-space:pre-wrap;font-weight:400">${esc(j.text)}</div>
          </div>
        </div>
      `)
      );
    });
  }
  return wrap;
}

// ── Inbox ──────────────────────────────────────────────────────────────────
async function renderInbox(main) {
  main.replaceChildren(h('<div class="empty">Loading…</div>'));
  let items;
  try {
    ({ items } = await guard(() => API.listInbox()));
  } catch {
    return;
  }

  const wrap = h(`
    <div>
      <div class="journal-add-form">
        <textarea id="bt-inbox-text" rows="2" placeholder="Capture a thought — sort it later"></textarea>
        <div style="margin-top:8px"><button class="btn-sm btn-sm-sage" id="bt-inbox-add">Add</button></div>
      </div>
      <div id="bt-inbox-list"></div>
    </div>
  `);

  const listEl = wrap.querySelector('#bt-inbox-list');
  const paint = (arr) => {
    listEl.replaceChildren();
    if (!arr.length) {
      listEl.appendChild(h('<div class="empty">Inbox is clear.</div>'));
      return;
    }
    arr.forEach((it) => {
      const drop = async () => {
        await guard(() => API.deleteInbox(it.id));
        arr = arr.filter((x) => x.id !== it.id);
        paint(arr);
      };
      const row = h(`
        <div class="inbox-item">
          <div class="check-title" style="font-weight:400;white-space:pre-wrap">${esc(it.text)}</div>
          <div class="check-sub">${esc(timeAgo(it.created_at))}</div>
          <div class="inbox-actions">
            <button class="btn-sm btn-sm-ghost" data-toproj>→ Project</button>
            <button class="btn-sm btn-sm-ghost" data-tostep>→ Step in…</button>
            <button class="btn-sm btn-sm-ghost" data-del>Delete</button>
          </div>
        </div>
      `);
      on(row, '[data-del]', 'click', drop);
      on(row, '[data-toproj]', 'click', () => {
        openProjectForm(null, { prefillTitle: it.text, onCreate: () => API.deleteInbox(it.id) });
      });
      on(row, '[data-tostep]', 'click', () => openAssignStep(it.text, drop));
      listEl.appendChild(row);
    });
  };

  on(wrap, '#bt-inbox-add', 'click', async () => {
    const ta = wrap.querySelector('#bt-inbox-text');
    const text = ta.value.trim();
    if (!text) return;
    const { item } = await guard(() => API.addInbox(text));
    ta.value = '';
    items = [item, ...items];
    paint(items);
  });

  paint(items);
  main.replaceChildren(wrap);
}

// Pick a project and drop the inbox text in as a step.
async function openAssignStep(text, done) {
  let projects;
  try {
    ({ projects } = await guard(() => API.listProjects()));
  } catch {
    return;
  }
  const usable = projects.filter((p) => p.role === 'owner' || p.role === 'editor');
  if (!usable.length) return toast('No project you can edit yet — make one first.');

  const overlay = h(`
    <div class="modal-overlay open">
      <div class="modal">
        <div class="modal-header"><span class="modal-title">Add as a step</span>
          <button class="modal-close" aria-label="Close">${icon('close')}</button></div>
        <form id="bt-assign">
          <div class="pickup-box" style="margin-bottom:14px"><div class="pickup-text">${esc(text)}</div></div>
          <label class="sp-label">Project</label>
          <select class="sp-select" name="project" required>
            ${usable
              .map((p) => `<option value="${p.id}">${esc(p.title)}</option>`)
              .join('')}
          </select>
          <div style="display:flex;gap:8px;margin-top:14px">
            <button type="submit" class="btn-sm btn-sm-sage">Add step</button>
            <button type="button" class="btn-sm btn-sm-ghost" data-cancel>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `);
  const close = () => overlay.remove();
  on(overlay, '.modal-close, [data-cancel]', 'click', close);
  overlay.addEventListener('click', (e) => e.target === overlay && close());
  on(overlay, '#bt-assign', 'submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    await guard(() => API.addStep(f.get('project'), { title: text }));
    close();
    toast('Added to the project');
    await done();
  });
  document.body.appendChild(overlay);
}

// ── Search ────────────────────────────────────────────────────────────────
function renderSearch(app) {
  app.replaceChildren();
  const bar = h(`
    <div class="header">
      <div class="search-row">
        <button class="search-back" id="bt-s-back" aria-label="Back">←</button>
        <input class="search-field" id="bt-s-input" type="search"
          placeholder="Search projects, steps, inbox" autocomplete="off" />
        <button class="search-clear" id="bt-s-clear" aria-label="Clear" hidden>${icon('close', 16)}</button>
      </div>
    </div>
  `);
  const main = h('<div class="project-list"></div>');
  app.append(bar, main);

  const input = bar.querySelector('#bt-s-input');
  const clearBtn = bar.querySelector('#bt-s-clear');
  input.value = state.searchQuery || '';
  clearBtn.hidden = !input.value;
  input.focus();

  let timer;
  input.addEventListener('input', () => {
    state.searchQuery = input.value;
    clearBtn.hidden = !input.value;
    clearTimeout(timer);
    timer = setTimeout(() => runSearch(main, input.value.trim()), 220);
  });
  on(bar, '#bt-s-back', 'click', () => {
    state.view = state.viewBeforeSearch || 'home';
    state.searchQuery = '';
    render();
  });
  on(bar, '#bt-s-clear', 'click', () => {
    input.value = '';
    state.searchQuery = '';
    clearBtn.hidden = true;
    input.focus();
    runSearch(main, '');
  });

  runSearch(main, (state.searchQuery || '').trim());
}

async function runSearch(main, q) {
  if (q.length < 2) {
    main.replaceChildren(h('<div class="empty">Type at least two characters.</div>'));
    return;
  }
  main.replaceChildren(h('<div class="empty">Searching…</div>'));
  let r;
  try {
    r = await guard(() => API.search(q));
  } catch {
    return;
  }
  const total =
    (r.projects?.length || 0) +
    (r.steps?.length || 0) +
    (r.inbox?.length || 0) +
    (r.people?.length || 0);
  if (!total) {
    main.replaceChildren(h(`<div class="empty">No matches for “${esc(q)}”.</div>`));
    return;
  }

  const wrap = h('<div></div>');
  const head = (label, n) => h(`<div class="s-head">${label} <span>${n}</span></div>`);

  if (r.projects?.length) {
    wrap.appendChild(head('Projects', r.projects.length));
    r.projects.forEach((p) => wrap.appendChild(projectCard(p)));
  }
  if (r.steps?.length) {
    wrap.appendChild(head('Steps', r.steps.length));
    r.steps.forEach((s) => {
      const row = h(`
        <button class="s-result">
          <div class="s-result-title${s.completed ? ' s-done' : ''}">${crumb(s.title, s.parent_title)}</div>
          <div class="s-result-sub">${esc(s.project_title)}${
            s.due_date ? ' · due ' + esc(fmtDate(s.due_date)) : ''
          }${s.estimate_minutes ? ' · ~' + esc(fmtDuration(s.estimate_minutes)) : ''}</div>
        </button>
      `);
      row.addEventListener('click', () => openProject(s.project_id));
      wrap.appendChild(row);
    });
  }
  if (r.inbox?.length) {
    wrap.appendChild(head('Inbox', r.inbox.length));
    r.inbox.forEach((it) => {
      const row = h('<div class="s-result"></div>');
      row.appendChild(h(`<div class="s-result-title">${esc(it.text)}</div>`));
      wrap.appendChild(row);
    });
  }
  if (r.people?.length) {
    wrap.appendChild(head('People', r.people.length));
    r.people.forEach((u) => wrap.appendChild(personRow(u)));
  }
  main.replaceChildren(wrap);
}

// ── Next actions ──────────────────────────────────────────────────────────
const NEXT_LINES = [
  'One thing at a time.',
  'Pick the smallest one. Start there.',
  'Momentum beats motivation.',
  'What’s the next physical action?',
  'Future you says thanks.',
  'Two minutes? Do it now.',
  'Start ugly. Fix it later.',
  'Progress, not perfection.',
];
const NICE_WORDS = ['nice', 'yes', 'done', 'boom', 'one down', 'keep going'];

async function renderNext(main) {
  main.replaceChildren(h('<div class="empty">Loading…</div>'));
  let data;
  try {
    data = await guard(() => API.review());
  } catch {
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const wkEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const buckets = { overdue: [], today: [], week: [], later: [], none: [] };
  (data.active || []).forEach((pr) => {
    const titleById = new Map((pr.open_steps || []).map((st) => [st.id, st.title]));
    withoutContainers(pr.open_steps || []).forEach((st) => {
      const s = {
        ...st,
        projectTitle: pr.title,
        parentTitle: st.parent_step_id ? titleById.get(st.parent_step_id) : undefined,
      };
      if (!s.due_date) buckets.none.push(s);
      else if (s.due_date < today) buckets.overdue.push(s);
      else if (s.due_date === today) buckets.today.push(s);
      else if (s.due_date <= wkEnd) buckets.week.push(s);
      else buckets.later.push(s);
    });
  });
  // Undated steps fold into "Later" — one collapsed card, not two.
  buckets.later = buckets.later.concat(buckets.none);
  buckets.none = [];
  Object.values(buckets).forEach((a) =>
    a.sort((x, y) => ((x.due_date || '9') < (y.due_date || '9') ? -1 : 1))
  );
  const remaining = () => Object.values(buckets).reduce((n, a) => n + a.length, 0);

  const wrap = h('<div class="next-wrap"></div>');
  const line = NEXT_LINES[Math.floor(Math.random() * NEXT_LINES.length)];
  const head = h(`
    <div class="next-head">
      <div class="next-line">${esc(line)}</div>
      <div class="next-count" id="bt-next-count"></div>
    </div>
  `);
  wrap.appendChild(head);

  const updateCount = () => {
    const dueN = buckets.overdue.length + buckets.today.length;
    const parts = [`${remaining()} open`];
    if (dueN) parts.push(`${dueN} due now`);
    if (state.doneThisSession) parts.push(`${state.doneThisSession} knocked out`);
    else if (data.done_this_week) parts.push(`${data.done_this_week} done this week`);
    head.querySelector('#bt-next-count').textContent = parts.join(' · ');
  };

  const showEmpty = () => {
    wrap.querySelectorAll('.next-group, .next-surprise, .empty').forEach((n) => n.remove());
    wrap.appendChild(
      h(`<div class="empty">${
        state.doneThisSession
          ? esc(
              `${state.doneThisSession} done. The list is clear — go make something.`
            )
          : 'No open steps in any active project. Add some, or go make something.'
      }</div>`)
    );
    updateCount();
  };

  if (!remaining()) {
    main.replaceChildren(wrap);
    showEmpty();
    return;
  }

  const surprise = h('<button class="next-surprise">Can’t choose? Surprise me →</button>');
  surprise.addEventListener('click', () => {
    const all = Object.values(buckets).flat();
    const pick = all[Math.floor(Math.random() * all.length)];
    if (!pick) return;
    const grp = wrap.querySelector(`.next-group[data-key="${bucketOf(pick)}"]`);
    if (grp) grp.classList.remove('collapsed');
    const el = wrap.querySelector(`.next-row[data-step="${pick.id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 1400);
    }
  });
  wrap.appendChild(surprise);

  function bucketOf(s) {
    if (!s.due_date) return 'later';
    if (s.due_date < today) return 'overdue';
    if (s.due_date === today) return 'today';
    if (s.due_date <= wkEnd) return 'week';
    return 'later';
  }

  [
    ['overdue', 'Overdue', false],
    ['today', 'Today', false],
    ['week', 'This week', false],
    ['later', 'Later', true],
  ].forEach(([key, label, collapsed]) => {
    const arr = buckets[key];
    if (!arr.length) return;
    const grp = h(`<div class="next-group${collapsed ? ' collapsed' : ''}" data-key="${key}"></div>`);
    const hd = h(`<button class="next-group-head">${label} <span>${arr.length}</span></button>`);
    hd.addEventListener('click', () => grp.classList.toggle('collapsed'));
    const gbody = h('<div class="next-group-body"></div>');
    arr.forEach((s) => gbody.appendChild(nextRow(s, key)));
    grp.append(hd, gbody);
    wrap.appendChild(grp);
  });

  main.replaceChildren(wrap);
  updateCount();

  function nextRow(s, key) {
    const sub =
      key === 'overdue' && s.due_date
        ? 'was due ' + fmtDate(s.due_date)
        : key === 'week' && s.due_date
          ? fmtDate(s.due_date)
          : key === 'later' && s.due_date
            ? fmtDate(s.due_date)
            : '';
    const tail = [sub, s.estimate_minutes ? '~' + fmtDuration(s.estimate_minutes) : '']
      .filter(Boolean)
      .join(' · ');
    const row = h(`
      <div class="next-row" data-step="${s.id}">
        <button class="checkbox" aria-label="Mark done"></button>
        <div class="next-row-main">
          <div class="next-row-title">${crumb(s.title, s.parentTitle)}</div>
          <div class="next-row-sub">${esc(s.projectTitle)}${tail ? ' · ' + esc(tail) : ''}</div>
        </div>
      </div>
    `);
    row.querySelector('.next-row-main').addEventListener('click', () => openProject(s.project_id));
    row.querySelector('.checkbox').addEventListener('click', async (e) => {
      e.stopPropagation();
      row.classList.add('done');
      try {
        await API.updateStep(s.project_id, s.id, { completed: true });
      } catch {
        row.classList.remove('done');
        toast('Could not update');
        return;
      }
      state.doneThisSession++;
      const arr = buckets[key];
      const i = arr.findIndex((x) => x.id === s.id);
      if (i > -1) arr.splice(i, 1);
      flashNice();
      updateCount();
      const badge = wrap.querySelector(`.next-group[data-key="${key}"] .next-group-head span`);
      if (badge) badge.textContent = arr.length;
      setTimeout(() => {
        row.remove();
        const grp = wrap.querySelector(`.next-group[data-key="${key}"]`);
        if (grp && !grp.querySelector('.next-row')) grp.remove();
        if (!remaining()) showEmpty();
      }, 320);
    });
    return row;
  }
}

function flashNice() {
  const el = h(`<div class="next-nice">${NICE_WORDS[Math.floor(Math.random() * NICE_WORDS.length)]}</div>`);
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 850);
}

// ── Weekly review ──────────────────────────────────────────────────────────
async function renderReview(main) {
  main.replaceChildren(h('<div class="empty">Loading…</div>'));
  let data;
  try {
    data = await guard(() => API.review());
  } catch {
    return;
  }

  const wrap = h('<div></div>');
  wrap.appendChild(
    h(
      '<p style="color:var(--text-muted);font-size:16px;margin-bottom:16px">Everything Active or Waiting For, with its open steps. A pass for your weekly review.</p>'
    )
  );
  if (data.done_this_week) {
    wrap.appendChild(
      h(
        `<p class="bt-review-stat">${data.done_this_week} step${
          data.done_this_week === 1 ? '' : 's'
        } completed in the last 7 days.</p>`
      )
    );
  }

  const section = (title, projects) => {
    const s = h(`<div style="margin-bottom:22px"><div class="section-header"><span class="section-label">${title} <span class="section-count">${projects.length}</span></span></div></div>`);
    if (!projects.length) {
      s.appendChild(h('<div class="empty-section">Nothing here.</div>'));
      return s;
    }
    projects.forEach((p) => {
      const allOpen = p.open_steps || [];
      const titleById = new Map(allOpen.map((st) => [st.id, st.title]));
      const leaves = withoutContainers(allOpen);
      const stepsHtml = leaves.length
        ? `<div style="margin-top:8px;display:flex;flex-direction:column;gap:4px">${leaves
            .map((st) => {
              const parentTitle = st.parent_step_id ? titleById.get(st.parent_step_id) : undefined;
              return `<div class="check-sub">• ${crumb(st.title, parentTitle)}${
                st.due_date ? ` — due ${esc(fmtDate(st.due_date))}` : ''
              }${st.estimate_minutes ? ` · ~${esc(fmtDuration(st.estimate_minutes))}` : ''}</div>`;
            })
            .join('')}</div>`
        : '<div class="check-sub" style="margin-top:8px;color:var(--text-faint)">No open steps</div>';
      const card = h(`
        <div class="card" role="button" tabindex="0" style="cursor:pointer">
          <div class="card-top"><h3 class="card-title">${esc(p.title)}</h3>
            <span class="status-pill" style="--tab-color:${STATUS_COLOR[p.status]}">${esc(p.status)}</span></div>
          <div class="card-meta">${esc(p.category || UNCATEGORIZED)}${
            p.deadline ? ` · due ${esc(fmtDate(p.deadline))}` : ''
          }</div>
          ${stepsHtml}
        </div>
      `);
      card.addEventListener('click', () => openProject(p.id));
      s.appendChild(card);
    });
    return s;
  };

  wrap.appendChild(section('Active', data.active || []));
  wrap.appendChild(section('Waiting For', data.waiting || []));
  main.replaceChildren(wrap);
}

// ── Planned focus time (work sessions) ────────────────────────────────────
const SESSION_DURATIONS = [
  [15, '15 min'],
  [30, '30 min'],
  [60, '1 hour'],
  [120, '2 hours'],
  [240, '4 hours'],
];

// Stored datetimes are "YYYY-MM-DD HH:MM:SS" UTC — parseTs() handles that.
function fmtSessionWhen(startsAt, endsAt) {
  const s = parseTs(startsAt);
  const e = parseTs(endsAt);
  const day = s.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const t = (d) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${t(s)}–${t(e)}`;
}

const sessionIsSoon = (sess) => {
  const now = Date.now();
  const s = parseTs(sess.starts_at).getTime();
  const e = parseTs(sess.ends_at).getTime();
  return sess.status === 'planned' && now >= s - 30 * 60000 && now <= e + 60 * 60000;
};

// date "YYYY-MM-DD" + time "HH:MM" (both local) -> ISO string for the API.
function localToIso(dateStr, timeStr) {
  const [y, mo, da] = dateStr.split('-').map(Number);
  const [hh, mi] = timeStr.split(':').map(Number);
  return new Date(y, mo - 1, da, hh, mi, 0, 0).toISOString();
}

function nextHourHHMM() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// bundle: the project detail bundle. existing: a session for edit, or null.
function openPlanForm(bundle, existing, onDone) {
  const s = existing || {};
  const open = bundle.steps.filter(
    (x) => !x.completed && !bundle.steps.some((o) => o.parent_step_id === x.id)
  );
  const startD = s.starts_at ? parseTs(s.starts_at) : null;
  const dateVal = startD
    ? `${startD.getFullYear()}-${String(startD.getMonth() + 1).padStart(2, '0')}-${String(startD.getDate()).padStart(2, '0')}`
    : isoInDays(0);
  const timeVal = startD
    ? `${String(startD.getHours()).padStart(2, '0')}:${String(startD.getMinutes()).padStart(2, '0')}`
    : nextHourHHMM();
  const curDur = existing
    ? Math.round((parseTs(s.ends_at).getTime() - parseTs(s.starts_at).getTime()) / 60000)
    : 60;

  const overlay = h(`
    <div class="modal-overlay open">
      <div class="modal">
        <div class="modal-header"><span class="modal-title">${existing ? 'Edit focus time' : 'Plan focus time'}</span>
          <button class="modal-close" aria-label="Close">${icon('close')}</button></div>
        <form id="bt-plan">
          <label class="sp-label">Day</label>
          <div class="bt-date-chips">
            <button type="button" class="bt-chip" data-days="0">Today</button>
            <button type="button" class="bt-chip" data-days="1">Tomorrow</button>
            <button type="button" class="bt-chip" data-weekend>This weekend</button>
            <button type="button" class="bt-chip" data-days="7">Next week</button>
          </div>
          <input class="sp-input" type="date" name="date" required value="${esc(dateVal)}" />
          <label class="sp-label">Start</label>
          <input class="sp-input" type="time" name="time" required value="${esc(timeVal)}" />
          <label class="sp-label">How long?</label>
          <div class="bt-dur-chips" id="bt-plan-dur">
            ${SESSION_DURATIONS.map(
              ([m, label]) =>
                `<button type="button" class="bt-chip${m === curDur ? ' is-sel' : ''}" data-dur="${m}">${label}</button>`
            ).join('')}
          </div>
          ${
            open.length
              ? `<label class="sp-label">Step (optional)</label>
          <select class="sp-input" name="stepId">
            <option value="">Whole project</option>
            ${open
              .map(
                (x) =>
                  `<option value="${esc(x.id)}"${x.id === s.step_id ? ' selected' : ''}>${esc(x.title)}</option>`
              )
              .join('')}
          </select>`
              : ''
          }
          <label class="sp-label">Note (optional)</label>
          <textarea class="sp-input" name="note" rows="2" maxlength="500">${esc(s.note || '')}</textarea>
          <div style="display:flex;gap:8px;margin-top:14px">
            <button type="submit" class="btn-sm btn-sm-sage">${existing ? 'Save' : 'Add to plan'}</button>
            ${existing ? '<button type="button" class="btn-sm btn-sm-ghost" data-del>Delete</button>' : ''}
            <button type="button" class="btn-sm btn-sm-ghost" data-cancel>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `);
  const close = () => overlay.remove();
  const dateInput = overlay.querySelector('input[name=date]');
  let dur = curDur;
  on(overlay, '.bt-chip[data-days]', 'click', (e) => {
    dateInput.value = isoInDays(Number(e.currentTarget.dataset.days));
  });
  on(overlay, '.bt-chip[data-weekend]', 'click', () => {
    dateInput.value = isoWeekend();
  });
  on(overlay, '#bt-plan-dur [data-dur]', 'click', (e) => {
    dur = Number(e.currentTarget.dataset.dur);
    overlay
      .querySelectorAll('#bt-plan-dur [data-dur]')
      .forEach((b) => b.classList.toggle('is-sel', Number(b.dataset.dur) === dur));
  });
  on(overlay, '.modal-close, [data-cancel]', 'click', close);
  overlay.addEventListener('click', (e) => e.target === overlay && close());
  on(overlay, '[data-del]', 'click', async () => {
    if (!(await btConfirm('Delete this planned focus time?', { danger: true, ok: 'Delete' }))) return;
    await guard(() => API.deleteSession(bundle.project.id, existing.id));
    close();
    onDone && onDone();
  });
  on(overlay, '#bt-plan', 'submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    if (!f.get('date') || !f.get('time')) return;
    const startsAt = localToIso(f.get('date'), f.get('time'));
    const endsAt = new Date(new Date(startsAt).getTime() + dur * 60000).toISOString();
    const body = {
      startsAt,
      endsAt,
      stepId: f.get('stepId') || null,
      note: (f.get('note') || '').trim() || null,
    };
    try {
      if (existing) await API.updateSession(bundle.project.id, existing.id, body);
      else await API.addSession(bundle.project.id, body);
      close();
      onDone && onDone();
    } catch (ex) {
      toast(ex.message || 'Could not save that focus time');
    }
  });
  document.body.appendChild(overlay);
}

// The "Upcoming focus time" block on the project detail view. Owns its own
// refresh so a plan edit doesn't need a full detail re-render.
function sessionsBlock(bundle) {
  const canEdit = bundle.project.role === 'owner' || bundle.project.role === 'editor';
  const wrap = h('<div class="bt-sessions"></div>');

  const paint = () => {
    wrap.replaceChildren();
    const head = h('<div class="bt-sessions-head"><span>Upcoming focus time</span></div>');
    if (canEdit) {
      const add = h('<button class="bt-linkbtn" id="bt-plan-add">+ Plan focus time</button>');
      add.addEventListener('click', () =>
        openPlanForm(bundle, null, refresh)
      );
      head.appendChild(add);
    }
    wrap.appendChild(head);

    const list = (bundle.sessions || []).filter((s) => s.status !== 'skipped');
    if (!list.length) {
      wrap.appendChild(
        h('<div class="bt-sessions-empty">Nothing scheduled. Plan a block of time to work on this.</div>')
      );
      return;
    }
    list.forEach((sess) => wrap.appendChild(sessionRow(sess, bundle, refresh)));
  };

  const refresh = async () => {
    try {
      const r = await API.projectSessions(bundle.project.id);
      bundle.sessions = r.sessions || [];
    } catch {
      /* keep what we have */
    }
    paint();
  };

  paint();
  return wrap;
}

function sessionRow(sess, bundle, refresh) {
  const row = h(`
    <div class="bt-session-row${sess.status === 'done' ? ' is-done' : ''}">
      <div class="bt-session-main">
        <div class="bt-session-when">${esc(fmtSessionWhen(sess.starts_at, sess.ends_at))}${
          sess.status === 'done' ? ' · done' : ''
        }</div>
        <div class="bt-session-sub">${
          sess.step_title ? esc(sess.step_title) : 'Whole project'
        }${sess.is_mine ? '' : ' · ' + esc(sess.planner.display_name || sess.planner.name || '@' + sess.planner.handle)}${
          sess.note ? ' · ' + esc(sess.note) : ''
        }</div>
      </div>
      <div class="bt-session-actions"></div>
    </div>
  `);
  const actions = row.querySelector('.bt-session-actions');

  if (sess.status === 'planned') {
    const start = h('<button class="btn-sm btn-sm-sage">Start now</button>');
    start.addEventListener('click', () =>
      openFocusSession(bundle, { stepId: sess.step_id, planSessionId: sess.id })
    );
    actions.appendChild(start);
  }
  if (sess.is_mine) {
    const edit = h('<button class="bt-linkbtn">Edit</button>');
    edit.addEventListener('click', () => openPlanForm(bundle, sess, refresh));
    actions.appendChild(edit);
  }
  return row;
}

// ── Focus session ─────────────────────────────────────────────────────────
const DURATIONS = [10, 25, 45, 60];
const RING = 326.7; // 2πr for r=52

let focusTimer = null;

function mmss(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function openFocusSession(bundle, opts = {}) {
  // Leaf steps only — a container isn't something you "work on" directly.
  const open = bundle.steps.filter(
    (s) => !s.completed && !bundle.steps.some((o) => o.parent_step_id === s.id)
  );
  const presetStep = opts.stepId && open.some((s) => s.id === opts.stepId) ? opts.stepId : null;
  const sess = {
    projectId: bundle.project.id,
    projectTitle: bundle.project.title,
    stepId: presetStep,
    minutes: 25,
    // A planned work_session this focus run is fulfilling — offered "mark done"
    // on the finish screen.
    planSessionId: opts.planSessionId || null,
  };

  const screen = h('<div id="focus-screen" class="open"></div>');
  const close = () => {
    if (focusTimer) {
      clearInterval(focusTimer);
      focusTimer = null;
    }
    screen.remove();
  };

  function setup() {
    screen.replaceChildren(
      h(`
      <div>
        <div class="focus-head">
          <div class="focus-wordmark">focus session</div>
          <button class="focus-close" aria-label="Close">${icon('close')}</button>
        </div>
        <div class="focus-body">
          <div class="focus-project-name">${esc(sess.projectTitle)}</div>
          <div class="focus-hero-text">What are you working on?</div>
          <div class="focus-checklist" id="fs-steps">
            ${
              open.length
                ? open
                    .map(
                      (s) =>
                        `<div class="focus-check-row${s.id === sess.stepId ? ' checked' : ''}" data-step="${s.id}">
                          <span class="focus-check-box"><span class="focus-check-icon">${icon('check', 16)}</span></span>
                          <span class="focus-check-label">${esc(s.title)}</span>
                        </div>`
                    )
                    .join('')
                : '<div class="focus-next-step empty">No open steps — just work on the project.</div>'
            }
          </div>
          <div class="focus-time-label">How long?</div>
          <div class="focus-time-options" id="fs-times">
            ${DURATIONS.map(
              (m) => `<button class="focus-time-btn${m === sess.minutes ? ' selected' : ''}" data-min="${m}">${m} min</button>`
            ).join('')}
          </div>
          <button class="focus-go-btn" id="fs-go">Start ${sess.minutes} minutes</button>
          <div class="focus-reassure">Stop whenever you need to. Nothing is lost.</div>
        </div>
      </div>
    `)
    );
    on(screen, '.focus-close', 'click', close);
    on(screen, '#fs-steps .focus-check-row', 'click', (e) => {
      const row = e.currentTarget;
      const id = row.dataset.step;
      const already = sess.stepId === id;
      screen.querySelectorAll('.focus-check-row').forEach((r) => r.classList.remove('checked'));
      sess.stepId = already ? null : id;
      if (!already) row.classList.add('checked');
    });
    on(screen, '#fs-times .focus-time-btn', 'click', (e) => {
      sess.minutes = Number(e.currentTarget.dataset.min);
      screen.querySelectorAll('.focus-time-btn').forEach((b) => b.classList.remove('selected'));
      e.currentTarget.classList.add('selected');
      screen.querySelector('#fs-go').textContent = `Start ${sess.minutes} minutes`;
    });
    on(screen, '#fs-go', 'click', () => running());
  }

  function running() {
    const totalMs = sess.minutes * 60000;
    const endsAt = Date.now() + totalMs;
    const step = open.find((s) => s.id === sess.stepId);

    screen.replaceChildren(
      h(`
      <div>
        <div class="focus-head">
          <div class="focus-wordmark">focus session</div>
          <button class="focus-close" aria-label="Close">${icon('close')}</button>
        </div>
        <div class="focus-body focus-body-timer">
          <div class="focus-timer-project">${esc(sess.projectTitle)}</div>
          <div class="focus-timer-step">${step ? esc(step.title) : 'Working on the project'}</div>
          <div class="focus-ring-wrap">
            <svg class="focus-ring" viewBox="0 0 120 120">
              <circle class="focus-ring-track" cx="60" cy="60" r="52"></circle>
              <circle class="focus-ring-fill" id="fs-ring" cx="60" cy="60" r="52" stroke-dashoffset="0"></circle>
            </svg>
            <div class="focus-timer-display" id="fs-clock">${mmss(totalMs)}</div>
          </div>
          <div class="focus-timer-nudge">Head down. You've got this.</div>
          <button class="focus-done-early-btn" id="fs-done">I'm done</button>
        </div>
      </div>
    `)
    );
    on(screen, '.focus-close', 'click', close);
    on(screen, '#fs-done', 'click', () => {
      clearInterval(focusTimer);
      focusTimer = null;
      finish(Date.now() - (endsAt - totalMs));
    });

    const clock = screen.querySelector('#fs-clock');
    const ring = screen.querySelector('#fs-ring');
    const tick = () => {
      const remaining = endsAt - Date.now();
      clock.textContent = mmss(remaining);
      ring.setAttribute('stroke-dashoffset', String(RING * Math.min(1, 1 - remaining / totalMs)));
      if (remaining <= 0) {
        clearInterval(focusTimer);
        focusTimer = null;
        finish(totalMs);
      }
    };
    if (focusTimer) clearInterval(focusTimer);
    focusTimer = setInterval(tick, 250);
    tick();
  }

  function finish(elapsedMs) {
    const mins = Math.max(1, Math.round(elapsedMs / 60000));
    const step = open.find((s) => s.id === sess.stepId);
    screen.replaceChildren(
      h(`
      <div>
        <div class="focus-head">
          <div class="focus-wordmark">focus session</div>
          <button class="focus-close" aria-label="Close">${icon('close')}</button>
        </div>
        <div class="focus-body focus-body-timer">
          <div class="focus-finish-emoji">${icon('leaf', 40)}</div>
          <div class="focus-finish-headline">Session done</div>
          <div class="focus-finish-time">${mins} minute${mins === 1 ? '' : 's'} on ${esc(sess.projectTitle)}</div>
          <div class="focus-finish-msg">What did you get done?</div>
          <textarea id="fs-note" rows="2" placeholder="Optional — adds a timeline note" style="width:100%;padding:12px 14px;border-radius:9px;border:1px solid var(--border-strong);background:var(--input);color:var(--text);font:inherit;font-size:16px;resize:vertical;margin-bottom:12px"></textarea>
          <div class="focus-finish-actions">
            ${step ? `<button class="btn-sm btn-sm-sage" id="fs-markdone">Mark “${esc(step.title)}” done</button>` : ''}
            ${sess.planSessionId ? '<button class="btn-sm btn-sm-sage" id="fs-plandone">Mark planned focus done</button>' : ''}
            <button class="btn-sm btn-sm-amethyst" id="fs-again">Another session</button>
            <button class="btn-sm btn-sm-ghost" id="fs-close">Done</button>
          </div>
        </div>
      </div>
    `)
    );

    const saveNote = async () => {
      const text = screen.querySelector('#fs-note').value.trim();
      if (text) {
        try {
          await API.addJournal(sess.projectId, `[${mins}m focus] ${text}`);
        } catch {
          /* non-fatal */
        }
      }
    };

    on(screen, '.focus-close, #fs-close', 'click', async () => {
      await saveNote();
      close();
      if (state.view === 'project' && state.project && state.project.project.id === sess.projectId) {
        refreshDetail();
      }
    });
    if (step) {
      on(screen, '#fs-markdone', 'click', async (e) => {
        e.currentTarget.disabled = true;
        await saveNote();
        try {
          await API.updateStep(sess.projectId, step.id, { completed: true });
        } catch {
          /* toast shown */
        }
        close();
        if (state.view === 'project') refreshDetail();
      });
    }
    if (sess.planSessionId) {
      on(screen, '#fs-plandone', 'click', async (e) => {
        e.currentTarget.disabled = true;
        await saveNote();
        try {
          await API.updateSession(sess.projectId, sess.planSessionId, { status: 'done' });
        } catch {
          /* toast shown */
        }
        close();
        if (state.view === 'project') refreshDetail();
      });
    }
    on(screen, '#fs-again', 'click', async () => {
      await saveNote();
      sess.stepId = null;
      setup();
    });
  }

  document.body.appendChild(screen);
  setup();
}

boot();
