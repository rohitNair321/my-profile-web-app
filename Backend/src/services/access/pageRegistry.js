'use strict';

/**
 * Page Registry — the single source of truth for every page an admin/user can
 * be granted access to. The frontend `ADMIN_NAV_ITEMS` mirrors these `key`s.
 *
 * Pure data + lookup helpers (no I/O) → trivially testable. Adding a page is a
 * data change here, not a logic change anywhere else (Open/Closed Principle).
 */

const SCOPE = Object.freeze({ ADMIN: 'admin', PUBLIC: 'public' });

const PAGES = Object.freeze([
  { key: 'overview',     label: 'Overview',       route: '/admin/overview',     scope: SCOPE.ADMIN, grantable: true  },
  { key: 'planner',      label: 'Planner',        route: '/admin/planner',      scope: SCOPE.ADMIN, grantable: true  },
  { key: 'profile',      label: 'Profile',        route: '/admin/profile',      scope: SCOPE.ADMIN, grantable: true  },
  { key: 'experience',   label: 'Experience',     route: '/admin/experience',   scope: SCOPE.ADMIN, grantable: true  },
  { key: 'projects',     label: 'Projects',       route: '/admin/projects',     scope: SCOPE.ADMIN, grantable: true  },
  { key: 'skills',       label: 'Skills',         route: '/admin/skills',       scope: SCOPE.ADMIN, grantable: true  },
  { key: 'themes',       label: 'Themes',         route: '/admin/themes',       scope: SCOPE.ADMIN, grantable: true  },
  { key: 'blog',         label: 'Learning Posts', route: '/admin/blog',         scope: SCOPE.ADMIN, grantable: true  },
  { key: 'about',        label: 'About Me',       route: '/admin/about',        scope: SCOPE.ADMIN, grantable: true  },
  { key: 'notification', label: 'Notifications',  route: '/admin/notification', scope: SCOPE.ADMIN, grantable: true  },
  { key: 'ai',           label: 'AI Usage',       route: '/admin/ai',           scope: SCOPE.ADMIN, grantable: true  },
  { key: 'analytics',    label: 'Analytics',      route: '/admin/analytics',    scope: SCOPE.ADMIN, grantable: true  },
  { key: 'security',     label: 'Security',       route: '/admin/security',     scope: SCOPE.ADMIN, grantable: true  },
  { key: 'social',       label: 'Social Links',   route: '/admin/social',       scope: SCOPE.ADMIN, grantable: true  },
  // Super-admin-only console — never grantable to admins/users.
  { key: 'access',       label: 'Access',         route: '/admin/access',       scope: SCOPE.ADMIN, grantable: false },
]);

const _byKey = new Map(PAGES.map((p) => [p.key, p]));

function getPages() { return PAGES; }
function getGrantablePages() { return PAGES.filter((p) => p.grantable); }
function getGrantableKeys() { return getGrantablePages().map((p) => p.key); }
function isValidPageKey(key) { return _byKey.has(key); }
function isGrantableKey(key) { const p = _byKey.get(key); return !!p && p.grantable; }

module.exports = {
  SCOPE,
  PAGES,
  getPages,
  getGrantablePages,
  getGrantableKeys,
  isValidPageKey,
  isGrantableKey,
};
