// tests/integration/contact.test.js
'use strict';

// ── Mock external dependencies ────────────────────────────────────
jest.mock('../../src/config/database', () => ({
  supabase: { from: jest.fn() },
  testConnection: jest.fn().mockResolvedValue(true),
}));

const { supabase } = require('../../src/config/database');
const contactController = require('../../src/controllers/contactController');

// ── Mock req/res helpers ──────────────────────────────────────────
function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

function mockReq(body = {}, params = {}, headers = {}) {
  return { body, params, headers, ip: '127.0.0.1' };
}

function makeChain(data, error = null) {
  const chain = {
    select:  jest.fn().mockReturnThis(),
    insert:  jest.fn().mockReturnThis(),
    update:  jest.fn().mockReturnThis(),
    delete:  jest.fn().mockReturnThis(),
    eq:      jest.fn().mockReturnThis(),
    order:   jest.fn().mockReturnThis(),
    filter:  jest.fn().mockReturnThis(),
    then: (resolve) => Promise.resolve({ data, error }).then(resolve),
    catch: (reject) => Promise.resolve({ data, error }).catch(reject),
  };
  return chain;
}

// ─────────────────────────────────────────────────────────────────

describe('contactController', () => {

  afterEach(() => jest.clearAllMocks());

  // ── submitContactForm ─────────────────────────────────────────

  describe('submitContactForm()', () => {
    const validBody = {
      firstName: 'John',
      lastName:  'Doe',
      email:     'john@example.com',
      message:   'Hello Rohit!',
    };

    it('returns 200 on valid submission', async () => {
      supabase.from.mockReturnValue(makeChain(null, null));
      const req = mockReq(validBody);
      const res = mockRes();

      await contactController.submitContactForm(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('success') })
      );
    });

    it('returns 400 for invalid email', async () => {
      const req = mockReq({ ...validBody, email: 'not-an-email' });
      const res = mockRes();

      await contactController.submitContactForm(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('still returns 200 even when DB insert fails (graceful degradation)', async () => {
      supabase.from.mockReturnValue(makeChain(null, { message: 'DB error' }));
      const req = mockReq(validBody);
      const res = mockRes();

      await contactController.submitContactForm(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ── getNotifications ──────────────────────────────────────────

  describe('getNotifications()', () => {
    it('returns notification list with unreadCount', async () => {
      const fakeMessages = [
        { id: '1', first_name: 'Alice', is_read: false },
        { id: '2', first_name: 'Bob',   is_read: true  },
      ];
      supabase.from.mockReturnValue(makeChain(fakeMessages));
      const req = mockReq();
      const res = mockRes();

      await contactController.getNotifications(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('notificationList');
      expect(body.unreadCount).toBe(1);
    });
  });

  // ── markAsRead ────────────────────────────────────────────────

  describe('markAsRead()', () => {
    it('returns 200 and updated list after marking read', async () => {
      const messages = [{ id: 'msg-1', is_read: true }];
      supabase.from.mockReturnValue(makeChain(messages));
      const req = mockReq({}, { id: 'msg-1' });
      const res = mockRes();

      await contactController.markAsRead(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ── deleteContactMessage ──────────────────────────────────────

  describe('deleteContactMessage()', () => {
    it('returns 200 and updated list after deletion', async () => {
      const messages = [];
      supabase.from.mockReturnValue(makeChain(messages));
      const req = mockReq({}, { id: 'msg-1' });
      const res = mockRes();

      await contactController.deleteContactMessage(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
