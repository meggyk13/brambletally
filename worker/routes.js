// Route table: [pattern, module]. `:name` segments become context.params.name.
// Each module exports onRequestGet / onRequestPost / onRequestPatch /
// onRequestDelete (or a catch-all onRequest). Match is exact on segment count
// plus literal segments, so order doesn't matter.

import * as authRequestLink from './api/auth/request-link.js';
import * as authCallback from './api/auth/callback.js';
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
import * as review from './api/review.js';
import * as search from './api/search.js';
import * as categories from './api/categories/index.js';
import * as category from './api/categories/categoryId.js';
import * as inbox from './api/inbox/index.js';
import * as inboxItem from './api/inbox/itemId.js';
import * as usersSearch from './api/users/search.js';
import * as profile from './api/profile/index.js';
import * as profileHandle from './api/profile/handle.js';

export const routes = [
  ['/api/auth/request-link', authRequestLink],
  ['/api/auth/callback', authCallback],
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

  ['/api/review', review],
  ['/api/search', search],
  ['/api/categories', categories],
  ['/api/categories/:categoryId', category],
  ['/api/inbox', inbox],
  ['/api/inbox/:itemId', inboxItem],
  ['/api/users/search', usersSearch],
  ['/api/profile', profile],
  ['/api/profile/handle', profileHandle],
];
