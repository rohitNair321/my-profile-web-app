// tests/unit/access/pageRegistry.test.js
const registry = require('../../../src/services/access/pageRegistry');

describe('pageRegistry', () => {
  it('exposes a non-empty, frozen page list', () => {
    expect(registry.getPages().length).toBeGreaterThan(0);
    expect(Object.isFrozen(registry.PAGES)).toBe(true);
  });

  it('every page has a unique key', () => {
    const keys = registry.getPages().map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('grantable keys exclude the super-admin-only "access" console', () => {
    const grantable = registry.getGrantableKeys();
    expect(grantable).toContain('planner');
    expect(grantable).not.toContain('access');
  });

  it('isValidPageKey / isGrantableKey behave correctly', () => {
    expect(registry.isValidPageKey('planner')).toBe(true);
    expect(registry.isValidPageKey('nope')).toBe(false);
    expect(registry.isGrantableKey('planner')).toBe(true);
    expect(registry.isGrantableKey('access')).toBe(false); // valid but not grantable
    expect(registry.isGrantableKey('nope')).toBe(false);
  });
});
