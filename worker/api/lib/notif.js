// Notification preferences shape. Stored as JSON on user_profiles.notif_prefs.
// Nothing sends yet — Phase 3 wires the board notifications and the digest cron
// against these values.

export const NOTIF_MODES = ['immediate', 'weekly', 'off'];
export const NOTIF_TYPES = [
  'follow',
  'contributor_request',
  'contributor_decided',
  'board_comment',
  'board_reply',
  'step_assigned',
  'step_due',
];

// `mode` default is 'weekly' (2026-09-08): a new account gets in-app
// notifications plus the one Sunday digest and no immediate email until it
// opts in. Conservative while volume against Resend's free cap is unproven.
export const DEFAULT_NOTIF_PREFS = {
  mode: 'weekly',
  types: {
    follow: true,
    contributor_request: true,
    contributor_decided: true,
    board_comment: true,
    board_reply: true,
    step_assigned: true,
    step_due: true,
  },
};

// Coerce arbitrary input to a known-good prefs object — unknown modes fall back
// to the default, unknown type keys are dropped, values are booleans.
export function sanitizeNotifPrefs(input) {
  const out = {
    mode: DEFAULT_NOTIF_PREFS.mode,
    types: { ...DEFAULT_NOTIF_PREFS.types },
  };
  if (input && NOTIF_MODES.includes(input.mode)) out.mode = input.mode;
  if (input && input.types && typeof input.types === 'object') {
    for (const t of NOTIF_TYPES) {
      if (t in input.types) out.types[t] = !!input.types[t];
    }
  }
  return out;
}

export function readNotifPrefs(json) {
  if (!json) return DEFAULT_NOTIF_PREFS;
  try {
    return sanitizeNotifPrefs(JSON.parse(json));
  } catch {
    return DEFAULT_NOTIF_PREFS;
  }
}
