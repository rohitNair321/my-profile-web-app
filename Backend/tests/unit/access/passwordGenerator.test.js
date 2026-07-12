// tests/unit/access/passwordGenerator.test.js
const { generatePassword, MIN_LENGTH } = require('../../../src/services/access/passwordGenerator');

describe('generatePassword', () => {
  it('honours the requested length', () => {
    expect(generatePassword(16)).toHaveLength(16);
    expect(generatePassword(24)).toHaveLength(24);
  });

  it('clamps to a safe minimum length', () => {
    expect(generatePassword(4).length).toBe(MIN_LENGTH);
    expect(generatePassword().length).toBeGreaterThanOrEqual(MIN_LENGTH);
  });

  it('contains at least one lower, upper, digit and symbol', () => {
    for (let i = 0; i < 50; i++) {
      const pw = generatePassword(12);
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/[0-9]/);
      expect(pw).toMatch(/[!@#$%^&*\-_=+]/);
    }
  });

  it('produces distinct passwords across calls', () => {
    const set = new Set(Array.from({ length: 100 }, () => generatePassword(16)));
    expect(set.size).toBe(100);
  });
});
