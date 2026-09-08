import { json, error } from '../lib/http.js';
import { isSupporter } from '../lib/plan.js';

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user) return error(401, 'Not signed in');
  return json({
    user,
    needs_handle: !user.handle,
    supporter: isSupporter(user),
  });
}
