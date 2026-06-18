// config/constants.js

module.exports = {
  // HTTP Status Codes
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_SERVER_ERROR: 500,
  },

  // Rate Limiting
  RATE_LIMIT: {
    GUEST_CHAT_LIMIT: 5,
    GUEST_WINDOW_HOURS: 24,
    API_WINDOW_MINUTES: 15,
    API_MAX_REQUESTS: 100,
  },

  // JWT
  JWT: {
    TOKEN_EXPIRY: '1d',
    RESET_TOKEN_EXPIRY: '1h',
  },

  PASSWORD_RESET: {
    OTP_LENGTH: 6,
    OTP_EXPIRY_MINUTES: 10,
  },

  // User Roles
  USER_ROLES: {
    ADMIN: 'admin',
    GUEST: 'guest',
  },

  // Cookie Settings
  COOKIE: {
    TOKEN_NAME: 'token',
    GUEST_ID_NAME: 'guestId',
    MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
  },

  // Validation
  VALIDATION: {
    PASSWORD_MIN_LENGTH: 8,
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
};
