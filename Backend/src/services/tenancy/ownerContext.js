'use strict';

/**
 * Tenancy — owner resolution.
 *
 * Single responsibility: decide *whose* portfolio a request operates on.
 *  - An authenticated non-guest user works on THEIR OWN data (`user.id`).
 *  - A public/guest request targets an explicitly-requested owner, else the
 *    primary portfolio owner (`PROFILE_OWNER_ID`) for backward compatibility.
 *
 * Pure w.r.t. its inputs; `defaultOwnerId` is injectable so it is unit-testable
 * without touching `process.env`.
 */
function resolveOwnerId(
  { user, requestedOwner } = {},
  { defaultOwnerId = process.env.PROFILE_OWNER_ID } = {}
) {
  if (user && user.id && user.role && user.role !== 'guest') {
    return user.id;
  }
  return requestedOwner || defaultOwnerId || null;
}

module.exports = { resolveOwnerId };
