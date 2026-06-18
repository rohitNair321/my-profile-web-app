// tests/setup.js
// Test setup and configuration

require('dotenv').config({ path: '.env.test' });

// ── Required env vars (must be set before server.js is imported) ──
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long!!';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
process.env.PROFILE_OWNER_ID = process.env.PROFILE_OWNER_ID || 'test-profile-owner-id';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-key';
process.env.LOG_LEVEL = 'error'; // Suppress logs during tests

// Global test timeout
jest.setTimeout(10000);

// Mock console methods to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  // Keep error and debug for troubleshooting
  error: console.error,
  debug: console.debug,
};
