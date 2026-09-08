// Route table: [pattern, module]. `:name` segments become context.params.name.
// Each module exports onRequestGet / onRequestPost / onRequestPatch /
// onRequestDelete (or a catch-all onRequest). Match is exact on segment count
// plus literal segments, so order doesn't matter.

import * as authRequestLink from './api/auth/request-link.js';
import * as authCallback from './api/auth/callback.js';
import * as authEmailChange from './api/auth/email-change.js';
import * as authLogout from './api/auth/logout.js';
import * as authMe from './api/auth/me.js';
import * as projects from './api/projects/index.js';
import * as project from './api/projects/id.js';
import * as steps from './api/projects/id/steps.js';
import * as step from './api/projects/id/steps/stepId.js';
import * as stepBash from './api/projects/id/steps/stepId/bash.js';
import * as supplies from './api/projects/id/supplies.js';
import * as supply from './api/projects/id/supplies/supplyId.js';
import * as links from './api/projects/id/links.js';
import * as link from './api/projects/id/links/linkId.js';
import * as journal from './api/projects/id/journal.js';
import * as collaborators from './api/projects/id/collaborators.js';
import * as transfer from './api/projects/id/transfer.js';
import * as projectSessions from './api/projects/id/sessions.js';
import * as projectSession from './api/projects/id/sessions/sessionId.js';
import * as sessionsList from './api/sessions.js';
import * as sessionDetail from './api/sessions/id.js';
import * as calendarFeed from './api/calendar/token.js';
import * as review from './api/review.js';
import * as search from './api/search.js';
import * as categories from './api/categories/index.js';
import * as category from './api/categories/categoryId.js';
import * as inbox from './api/inbox/index.js';
import * as inboxItem from './api/inbox/itemId.js';
import * as usersSearch from './api/users/search.js';
import * as profile from './api/profile/index.js';
import * as profileHandle from './api/profile/handle.js';
import * as profileLinks from './api/profile/links.js';
import * as profileByHandle from './api/profile/byHandle.js';
import * as profileFollows from './api/profile/follows.js';
import * as interests from './api/interests/index.js';
import * as interest from './api/interests/slug.js';
import * as follows from './api/follows/index.js';
import * as follow from './api/follows/handle.js';
import * as feed from './api/feed/index.js';
import * as blocks from './api/blocks/index.js';
import * as block from './api/blocks/handle.js';
import * as notifications from './api/notifications/index.js';
import * as notificationsRead from './api/notifications/read.js';
import * as board from './api/board/index.js';
import * as boardListing from './api/board/listingId.js';
import * as boardComments from './api/board/listingId/comments.js';
import * as boardComment from './api/board/listingId/comments/commentId.js';
import * as boardRequests from './api/board/listingId/requests.js';
import * as boardRequest from './api/board/listingId/requests/requestId.js';
import * as reports from './api/reports/index.js';
import * as adminInterests from './api/admin/interests/index.js';
import * as adminInterestMerge from './api/admin/interests/merge.js';
import * as adminInterest from './api/admin/interests/slug.js';
import * as adminReports from './api/admin/reports/index.js';
import * as adminReport from './api/admin/reports/reportId.js';
import * as adminListings from './api/admin/listings.js';
import * as adminUser from './api/admin/users/handle.js';
import * as adminUserSanction from './api/admin/users/handle/sanction.js';
import * as settingsNotifPrefs from './api/settings/notif-prefs.js';
import * as settingsExport from './api/settings/export.js';
import * as settingsEmail from './api/settings/email.js';
import * as settingsCalendarToken from './api/settings/calendar-token.js';
import * as settingsTimezone from './api/settings/timezone.js';
import * as legalAccept from './api/legal/accept.js';
import * as account from './api/account.js';

export const routes = [
  ['/api/auth/request-link', authRequestLink],
  ['/api/auth/callback', authCallback],
  ['/api/auth/email-change', authEmailChange],
  ['/api/auth/logout', authLogout],
  ['/api/auth/me', authMe],

  ['/api/projects', projects],
  ['/api/projects/:id', project],
  ['/api/projects/:id/steps', steps],
  ['/api/projects/:id/steps/:stepId', step],
  ['/api/projects/:id/steps/:stepId/bash', stepBash],
  ['/api/projects/:id/supplies', supplies],
  ['/api/projects/:id/supplies/:supplyId', supply],
  ['/api/projects/:id/links', links],
  ['/api/projects/:id/links/:linkId', link],
  ['/api/projects/:id/journal', journal],
  ['/api/projects/:id/collaborators', collaborators],
  ['/api/projects/:id/transfer', transfer],
  ['/api/projects/:id/sessions', projectSessions],
  ['/api/projects/:id/sessions/:sessionId', projectSession],

  ['/api/sessions', sessionsList],
  ['/api/sessions/:id', sessionDetail],
  ['/api/calendar/:token', calendarFeed],
  ['/api/review', review],
  ['/api/search', search],
  ['/api/categories', categories],
  ['/api/categories/:categoryId', category],
  ['/api/inbox', inbox],
  ['/api/inbox/:itemId', inboxItem],
  ['/api/users/search', usersSearch],
  ['/api/profile', profile],
  // literal 4-segment paths must precede '/api/profile/:handle' — first match wins
  ['/api/profile/handle', profileHandle],
  ['/api/profile/links', profileLinks],
  ['/api/profile/:handle', profileByHandle],
  ['/api/profile/:handle/followers', profileFollows],
  ['/api/profile/:handle/following', profileFollows],
  ['/api/interests', interests],
  ['/api/interests/:slug', interest],
  ['/api/follows', follows],
  ['/api/follows/:handle', follow],
  ['/api/feed', feed],
  ['/api/blocks', blocks],
  ['/api/blocks/:handle', block],
  ['/api/notifications', notifications],
  ['/api/notifications/read', notificationsRead],
  ['/api/board', board],
  ['/api/board/:listingId', boardListing],
  ['/api/board/:listingId/comments', boardComments],
  ['/api/board/:listingId/comments/:commentId', boardComment],
  ['/api/board/:listingId/requests', boardRequests],
  ['/api/board/:listingId/requests/:requestId', boardRequest],
  ['/api/reports', reports],
  ['/api/admin/interests', adminInterests],
  // literal 'merge' must precede '/api/admin/interests/:slug' — first match wins
  ['/api/admin/interests/merge', adminInterestMerge],
  ['/api/admin/interests/:slug', adminInterest],
  ['/api/admin/reports', adminReports],
  ['/api/admin/reports/:reportId', adminReport],
  ['/api/admin/listings', adminListings],
  ['/api/admin/users/:handle', adminUser],
  ['/api/admin/users/:handle/sanction', adminUserSanction],
  ['/api/settings/notif-prefs', settingsNotifPrefs],
  ['/api/settings/export', settingsExport],
  ['/api/settings/email', settingsEmail],
  ['/api/settings/calendar-token', settingsCalendarToken],
  ['/api/settings/timezone', settingsTimezone],
  ['/api/legal/accept', legalAccept],
  ['/api/account', account],
];
