import { error } from './http.js';

// Guard for the in-app admin panel routes. Returns { user } on success, or
// { fail: Response }. A non-admin gets 404, not 403, so the admin surface
// doesn't announce itself. `is_admin` is already on context.data.user
// (selected + coerced to bool in session.js).
export function requireAdmin(context) {
  const user = context.data.user;
  if (!user) return { fail: error(401, 'Not signed in') };
  if (!user.is_admin) return { fail: error(404, 'Not found') };
  return { user };
}
