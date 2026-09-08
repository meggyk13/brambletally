// @handle rules, shared by the set-handle endpoint. The client mirrors the
// format checks in public/app.js for inline feedback.

const RESERVED = new Set([
  'admin', 'administrator', 'api', 'app', 'auth', 'about', 'block', 'blocks',
  'board', 'brambletally', 'contact', 'cookies', 'feed', 'follow', 'follows',
  'followers', 'following', 'handle', 'help', 'home', 'interest', 'interests',
  'legal', 'links', 'login', 'logout', 'me', 'mod', 'moderator', 'notifications',
  'privacy', 'profile', 'profiles', 'root', 'settings', 'signin', 'signup',
  'staff', 'support', 'system', 'team', 'terms', 'user', 'users', 'you',
]);

// -> { handle } on success, or { error } with a human-readable reason.
export function normalizeHandle(raw) {
  if (typeof raw !== 'string') return { error: 'Enter a handle.' };
  const h = raw.trim().toLowerCase();
  if (h.length < 3) return { error: 'At least 3 characters.' };
  if (h.length > 20) return { error: '20 characters or fewer.' };
  if (!/^[a-z0-9_]+$/.test(h)) return { error: 'Letters, numbers and underscores only.' };
  if (h.startsWith('_') || h.endsWith('_')) return { error: "Can't start or end with an underscore." };
  if (RESERVED.has(h)) return { error: 'That handle is reserved.' };
  return { handle: h };
}
