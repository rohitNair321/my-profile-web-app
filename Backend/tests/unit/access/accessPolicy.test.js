// tests/unit/access/accessPolicy.test.js
const policy = require('../../../src/services/access/accessPolicy');

const { ROLES } = policy;

describe('accessPolicy', () => {
  describe('canManageUsers', () => {
    it('allows only super admin', () => {
      expect(policy.canManageUsers(ROLES.SUPER_ADMIN)).toBe(true);
      expect(policy.canManageUsers(ROLES.ADMIN)).toBe(false);
      expect(policy.canManageUsers(ROLES.USER)).toBe(false);
    });
  });

  describe('validateGrant', () => {
    it('super admin may grant any grantable page', () => {
      const r = policy.validateGrant(ROLES.SUPER_ADMIN, [], ['planner', 'analytics']);
      expect(r).toEqual({ ok: true, invalidKeys: [] });
    });

    it('rejects non-grantable keys even for super admin', () => {
      const r = policy.validateGrant(ROLES.SUPER_ADMIN, [], ['access', 'nope']);
      expect(r.ok).toBe(false);
      expect(r.invalidKeys).toEqual(['access', 'nope']);
    });

    it('admin may grant only pages they themselves hold', () => {
      const ok = policy.validateGrant(ROLES.ADMIN, ['planner'], ['planner']);
      expect(ok.ok).toBe(true);

      const bad = policy.validateGrant(ROLES.ADMIN, ['planner'], ['analytics']);
      expect(bad.ok).toBe(false);
      expect(bad.invalidKeys).toEqual(['analytics']);
    });

    it('a plain user may grant nothing', () => {
      const r = policy.validateGrant(ROLES.USER, ['planner'], ['planner']);
      expect(r.ok).toBe(false);
    });

    it('an empty request is trivially valid', () => {
      expect(policy.validateGrant(ROLES.ADMIN, [], []).ok).toBe(true);
    });
  });

  describe('accessibleKeys', () => {
    it('super admin sees every page key', () => {
      const keys = policy.accessibleKeys(ROLES.SUPER_ADMIN, []);
      expect(keys).toContain('access');
      expect(keys.length).toBeGreaterThan(1);
    });

    it('others see only their granted keys', () => {
      expect(policy.accessibleKeys(ROLES.USER, ['planner'])).toEqual(['planner']);
      expect(policy.accessibleKeys(ROLES.ADMIN, [])).toEqual([]);
    });
  });
});
