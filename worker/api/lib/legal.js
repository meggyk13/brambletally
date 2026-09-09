import { TOS_VERSION } from './constants.js';

// True when a signed-in user still owes an acceptance of the current Terms —
// they've never accepted, or accepted an older version. The router blocks all
// but a small allowlist of routes while this holds; the client shows the
// acceptance gate.
export const needsTos = (user) =>
  !!user && (!user.tos_accepted_at || user.tos_version !== TOS_VERSION);
