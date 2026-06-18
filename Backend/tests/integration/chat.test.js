// tests/integration/chat.test.js
'use strict';

// ── Mock external dependencies ───────────────────────────────────
jest.mock('../../src/config/database', () => ({
  supabase: { from: jest.fn() },
  testConnection: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/services/aiService', () => ({
  askAI: jest.fn().mockResolvedValue('Mocked AI response'),
}));

const { supabase } = require('../../src/config/database');
const chatService   = require('../../src/services/chatService');

// ── Chain builder ─────────────────────────────────────────────────
function makeChain(data, error = null) {
  return {
    select:     jest.fn().mockReturnThis(),
    eq:         jest.fn().mockReturnThis(),
    gte:        jest.fn().mockReturnThis(),
    insert:     jest.fn().mockReturnThis(),
    update:     jest.fn().mockReturnThis(),
    delete:     jest.fn().mockReturnThis(),
    order:      jest.fn().mockReturnThis(),
    single:     jest.fn().mockResolvedValue({ data, error }),
    maybeSingle:jest.fn().mockResolvedValue({ data, error }),
    // For array returns (no .single())
    then: (resolve) => resolve({ data, error }),
    // make the chain thenable for await
    [Symbol.for('nodejs.rejection')]: undefined,
  };
}

function makeArrayChain(data, error = null) {
  const chain = {
    select:  jest.fn().mockReturnThis(),
    eq:      jest.fn().mockReturnThis(),
    gte:     jest.fn().mockReturnThis(),
    order:   jest.fn().mockReturnThis(),
    update:  jest.fn().mockReturnThis(),
    delete:  jest.fn().mockReturnThis(),
    insert:  jest.fn().mockReturnThis(),
    single:  jest.fn().mockResolvedValue({ data: data?.[0] ?? null, error }),
    select_result: Promise.resolve({ data, error }),
  };
  // Make it awaitable directly (for queries without .single())
  Object.assign(chain, Promise.resolve({ data, error }));
  chain.then = (resolve) => Promise.resolve({ data, error }).then(resolve);
  chain.catch = (reject) => Promise.resolve({ data, error }).catch(reject);
  return chain;
}

// ────────────────────────────────────────────────────────────────

describe('chatService', () => {

  afterEach(() => jest.clearAllMocks());

  // ── sendChatMessage ───────────────────────────────────────────

  describe('sendChatMessage()', () => {
    const baseParams = {
      message:   'Hello',
      sessionId: null,
      userId:    'user-1',
      role:      'admin',
      guestId:   null,
      userIp:    '127.0.0.1',
    };

    it('returns AI response for admin user', async () => {
      const newSession = {
        id: 'sess-1', messages: [], title: 'Hello',
        role: 'admin', is_guest: false,
      };
      // First call: insert session, second call: update session messages
      supabase.from
        .mockReturnValueOnce(makeChain(newSession))   // insert new session
        .mockReturnValueOnce(makeChain(newSession));  // update session messages

      const result = await chatService.sendChatMessage(baseParams);

      expect(result.response).toBe('Mocked AI response');
      expect(result.limitReached).toBeFalsy();
      expect(result.sessionId).toBe('sess-1');
    });

    it('returns limitReached for guest over limit', async () => {
      // Simulate 5 sessions with 1 user message each (= 5 messages)
      const sessions = Array.from({ length: 5 }, (_, i) => ({
        messages: [{ sender: 'user', text: 'hi', time: new Date().toISOString() }],
        role: 'guest',
        guest_id: 'guest-abc',
        created_at: new Date().toISOString(),
      }));
      supabase.from.mockReturnValue(makeArrayChain(sessions));

      const result = await chatService.sendChatMessage({
        ...baseParams,
        role: 'guest',
        guestId: 'guest-abc',
        userId: null,
      });

      expect(result.limitReached).toBe(true);
      expect(result.remainingQuestions).toBe(0);
    });

    it('creates new session when no sessionId provided', async () => {
      const newSession = { id: 'new-sess', messages: [], role: 'admin' };
      supabase.from
        .mockReturnValueOnce(makeArrayChain([]))     // checkGuestLimit no-op for admin
        .mockReturnValueOnce(makeChain(newSession))  // insert session
        .mockReturnValueOnce(makeChain(newSession)); // update messages

      // Admin skips guest limit check — just needs create + update
      supabase.from
        .mockReturnValueOnce(makeChain(newSession))
        .mockReturnValueOnce(makeChain(newSession));

      const result = await chatService.sendChatMessage({ ...baseParams, sessionId: null });
      expect(result).toHaveProperty('sessionId');
    });
  });

  // ── getChatSessions ────────────────────────────────────────────

  describe('getChatSessions()', () => {
    it('returns empty array when no sessions exist', async () => {
      supabase.from.mockReturnValue(makeArrayChain([]));
      const result = await chatService.getChatSessions({
        userId: 'u1', role: 'admin', guestId: null,
      });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ── deleteChatSession ──────────────────────────────────────────

  describe('deleteChatSession()', () => {
    it('does not throw when session is deleted', async () => {
      supabase.from.mockReturnValue(makeArrayChain(null));
      await expect(
        chatService.deleteChatSession('sess-1', 'u1', 'admin', null)
      ).resolves.not.toThrow();
    });
  });
});
