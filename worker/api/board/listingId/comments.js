import { json, error, readJson } from '../../lib/http.js';
import { uuid } from '../../lib/id.js';
import { blockedBetween } from '../../lib/blocks.js';
import { trimOrNull } from '../../lib/validate.js';
import { COMMENT_MAX, loadListing, requireBoardOk } from '../../lib/board.js';

// POST /api/board/:listingId/comments — { body, parentCommentId? }.
// One level of replies: a parentCommentId must be a top-level comment on this
// listing.
export async function onRequestPost(context) {
  const me = context.data.user;
  if (!me) return error(401, 'Not signed in');
  const gate = requireBoardOk(me);
  if (gate.fail) return gate.fail;

  const { listingId } = context.params;
  const listing = await loadListing(context.env, listingId);
  if (!listing) return error(404, 'Listing not found');
  if (listing.status === 'archived') return error(409, 'This listing is archived');
  if (listing.owner_id !== me.id && (await blockedBetween(context.env, me.id, listing.owner_id)))
    return error(404, 'Listing not found');

  const body = await readJson(context.request);
  const text = trimOrNull(body && body.body, COMMENT_MAX);
  if (!text) return error(400, 'Say something first');

  let parentId = null;
  if (body && body.parentCommentId) {
    const parent = await context.env.DB.prepare(
      `SELECT id FROM listing_comments
        WHERE id = ? AND listing_id = ? AND parent_comment_id IS NULL AND deleted_at IS NULL`
    )
      .bind(body.parentCommentId, listingId)
      .first();
    if (!parent) return error(400, 'That comment can’t be replied to');
    parentId = parent.id;
  }

  const id = uuid();
  await context.env.DB.prepare(
    `INSERT INTO listing_comments (id, listing_id, user_id, parent_comment_id, body)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(id, listingId, me.id, parentId, text)
    .run();

  const row = await context.env.DB.prepare(
    `SELECT c.*, u.handle AS a_handle, u.display_name AS a_display_name,
            u.name AS a_name, u.plan AS a_plan
       FROM listing_comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?`
  )
    .bind(id)
    .first();

  return json(
    {
      comment: {
        id: row.id,
        parent_comment_id: row.parent_comment_id,
        body: row.body,
        deleted: false,
        created_at: row.created_at,
        edited_at: null,
        author: {
          handle: row.a_handle,
          display_name: row.a_display_name,
          name: row.a_name,
          supporter: row.a_plan === 'supporter',
        },
        is_mine: true,
        can_delete: true,
        replies: [],
      },
    },
    { status: 201 }
  );
}
