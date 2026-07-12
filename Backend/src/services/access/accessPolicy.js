'use strict';

const { isGrantableKey, getPages } = require('./pageRegistry');

/**
 * Authorization Policy — pure functions, no I/O.
 *
 * Encapsulates *who may do what* so controllers and services stay declarative
 * and the rules are exhaustively unit-testable in isolation.
 */

const ROLES = Object.freeze({
  SUPER_ADMIN: 'superadmin',
  ADMIN:       'admin',
  USER:        'user',
  GUEST:       'guest',
});

/** Only a super admin manages users and grants. */
function canManageUsers(role) {
  return role === ROLES.SUPER_ADMIN;
}

/**
 * Validate the set of page keys an actor wants to grant.
 *  - super admin → may grant any *grantable* page.
 *  - admin       → may grant only grantable pages they themselves hold.
 *  - anyone else → may grant nothing.
 *
 * @returns {{ ok: boolean, invalidKeys: string[] }}
 */
function validateGrant(actorRole, actorGrantedKeys = [], requestedKeys = []) {
  const held = new Set(actorGrantedKeys);
  const invalidKeys = [];

  for (const key of requestedKeys) {
    if (!isGrantableKey(key)) { invalidKeys.push(key); continue; }
    if (actorRole === ROLES.SUPER_ADMIN) continue;
    if (actorRole === ROLES.ADMIN && held.has(key)) continue;
    invalidKeys.push(key);
  }

  return { ok: invalidKeys.length === 0, invalidKeys };
}

/** Super admin sees every page; everyone else sees only their granted keys. */
function accessibleKeys(role, grantedKeys = []) {
  return role === ROLES.SUPER_ADMIN
    ? getPages().map((p) => p.key)
    : [...grantedKeys];
}

module.exports = { ROLES, canManageUsers, validateGrant, accessibleKeys };
