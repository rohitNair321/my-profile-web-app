// tests/unit/tenancy/ownerContext.test.js
const { resolveOwnerId } = require('../../../src/services/tenancy/ownerContext');

describe('resolveOwnerId', () => {
  it('uses the authenticated user id for a non-guest user', () => {
    expect(resolveOwnerId({ user: { id: 'u1', role: 'admin' } })).toBe('u1');
    expect(resolveOwnerId({ user: { id: 'sa', role: 'superadmin' } })).toBe('sa');
    expect(resolveOwnerId({ user: { id: 'u2', role: 'user' } })).toBe('u2');
  });

  it('falls back to the requested owner for a guest', () => {
    const r = resolveOwnerId(
      { user: { id: 'g', role: 'guest' }, requestedOwner: 'owner-9' },
      { defaultOwnerId: 'default' }
    );
    expect(r).toBe('owner-9');
  });

  it('falls back to the default owner when no user and no request', () => {
    expect(resolveOwnerId({}, { defaultOwnerId: 'default-owner' })).toBe('default-owner');
  });

  it('prefers the requested owner over the default for anonymous access', () => {
    expect(resolveOwnerId({ requestedOwner: 'req' }, { defaultOwnerId: 'def' })).toBe('req');
  });

  it('returns null when nothing resolves', () => {
    expect(resolveOwnerId({}, { defaultOwnerId: null })).toBeNull();
  });
});
