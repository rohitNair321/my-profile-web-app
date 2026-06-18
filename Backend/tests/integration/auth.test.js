// tests/integration/auth.test.js
'use strict';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// ── Mock Supabase before requiring anything that imports it ──────
jest.mock('../../src/config/database', () => ({
  supabase: {
    from: jest.fn(),
  },
  testConnection: jest.fn().mockResolvedValue(true),
}));

const { supabase } = require('../../src/config/database');
const authService = require('../../src/services/authService');

// ── Helpers ──────────────────────────────────────────────────────
function makeChain(data, error = null) {
  const chain = {
    select:     jest.fn().mockReturnThis(),
    eq:         jest.fn().mockReturnThis(),
    single:     jest.fn().mockResolvedValue({ data, error }),
    maybeSingle:jest.fn().mockResolvedValue({ data, error }),
    update:     jest.fn().mockReturnThis(),
    insert:     jest.fn().mockReturnThis(),
    limit:      jest.fn().mockReturnThis(),
  };
  return chain;
}

// ────────────────────────────────────────────────────────────────

describe('authService', () => {

  afterEach(() => jest.clearAllMocks());

  // ── login ──────────────────────────────────────────────────────

  describe('login()', () => {
    const hash = bcrypt.hashSync('correct-pass', 1);
    const fakeUser = {
      id: 'user-1', email: 'admin@test.com',
      password_hash: hash, role: 'admin', is_active: true,
    };

    it('returns token and user on valid credentials', async () => {
      supabase.from.mockReturnValue(makeChain(fakeUser));

      const result = await authService.login('admin@test.com', 'correct-pass');

      expect(result).toHaveProperty('token');
      expect(result.user.email).toBe('admin@test.com');
      expect(result.user.role).toBe('admin');
      const decoded = jwt.verify(result.token, process.env.JWT_SECRET);
      expect(decoded.role).toBe('admin');
    });

    it('throws 401 for wrong password', async () => {
      supabase.from.mockReturnValue(makeChain(fakeUser));
      await expect(authService.login('admin@test.com', 'wrong-pass'))
        .rejects.toMatchObject({ statusCode: 401 });
    });

    it('throws 401 when user not found', async () => {
      supabase.from.mockReturnValue(makeChain(null, { message: 'not found' }));
      await expect(authService.login('nobody@test.com', 'pass'))
        .rejects.toMatchObject({ statusCode: 401 });
    });

    it('throws 403 for disabled account', async () => {
      supabase.from.mockReturnValue(makeChain({ ...fakeUser, is_active: false }));
      await expect(authService.login('admin@test.com', 'correct-pass'))
        .rejects.toMatchObject({ statusCode: 403 });
    });
  });

  // ── initAppData ────────────────────────────────────────────────

  describe('initAppData()', () => {
    it('returns guest data when no user provided', async () => {
      supabase.from.mockReturnValue(makeChain({ themes: [], currenttheme: 'default' }));
      const result = await authService.initAppData(null);
      expect(result.role).toBe('guest');
      expect(result.id).toBe(process.env.PROFILE_OWNER_ID);
    });

    it('returns admin data for authenticated user', async () => {
      supabase.from.mockReturnValue(makeChain({ themes: [] }));
      const user = { id: 'user-1', role: 'admin', email: 'a@b.com' };
      const result = await authService.initAppData(user);
      expect(result.role).toBe('admin');
      expect(result.email).toBe('a@b.com');
    });
  });

  // ── forgotPassword ─────────────────────────────────────────────

  describe('forgotPassword()', () => {
    it('returns safe message regardless of whether email exists', async () => {
      supabase.from.mockReturnValue(makeChain(null));
      const result = await authService.forgotPassword('nobody@test.com');
      expect(result.message).toMatch(/if this email exists/i);
    });

    it('returns safe message when email exists', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      supabase.from.mockReturnValue(
        makeChain({ id: 'user-1', email: 'a@test.com' })
      );
      const result = await authService.forgotPassword('a@test.com');
      expect(result.message).toMatch(/if this email exists/i);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[RESET_PASSWORD_OTP]')
      );
      consoleSpy.mockRestore();
    });
  });

  // ── resetPassword ──────────────────────────────────────────────

  describe('resetPassword()', () => {
    it('resets password with valid otp', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      supabase.from.mockReturnValue(makeChain({ id: 'user-1', email: 'a@test.com' }));
      await authService.forgotPassword('a@test.com');
      const otpLog = consoleSpy.mock.calls[0][0];
      const otp = otpLog.match(/otp=(\d{6})/)[1];

      supabase.from.mockReturnValue(makeChain(null));
      const result = await authService.resetPassword('a@test.com', otp, 'new-secure-pass!');
      expect(result.message).toMatch(/successful/i);
      consoleSpy.mockRestore();
    });

    it('throws 400 for expired/invalid otp', async () => {
      await expect(authService.resetPassword('a@test.com', '123456', 'new-secure-pass!'))
        .rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws 400 for incorrect otp', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      supabase.from.mockReturnValue(makeChain({ id: 'user-1', email: 'a@test.com' }));
      await authService.forgotPassword('a@test.com');
      supabase.from.mockReturnValue(makeChain(null));

      await expect(authService.resetPassword('a@test.com', '000000', 'new-secure-pass!'))
        .rejects.toMatchObject({ statusCode: 400 });
      consoleSpy.mockRestore();
    });
  });

  // ── updatePassword ─────────────────────────────────────────────

  describe('updatePassword()', () => {
    const hash = bcrypt.hashSync('old-pass', 1);

    it('updates password when current password is correct', async () => {
      const chain = makeChain({ id: 'u1', password_hash: hash });
      supabase.from.mockReturnValue(chain);
      const result = await authService.updatePassword('a@b.com', 'old-pass', 'new-pass!');
      expect(result.message).toMatch(/updated/i);
    });

    it('throws 401 when current password is wrong', async () => {
      supabase.from.mockReturnValue(makeChain({ id: 'u1', password_hash: hash }));
      await expect(authService.updatePassword('a@b.com', 'wrong', 'new'))
        .rejects.toMatchObject({ statusCode: 401 });
    });

    it('throws 404 when user not found', async () => {
      supabase.from.mockReturnValue(makeChain(null, { message: 'not found' }));
      await expect(authService.updatePassword('x@b.com', 'old', 'new'))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
