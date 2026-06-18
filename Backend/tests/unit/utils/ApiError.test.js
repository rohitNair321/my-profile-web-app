// tests/unit/utils/ApiError.test.js
const ApiError = require('../../../src/utils/ApiError');

describe('ApiError', () => {
  describe('constructor', () => {
    it('should create error with correct properties', () => {
      const error = new ApiError(400, 'Bad Request');

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Bad Request');
      expect(error.success).toBe(false);
      expect(error.isOperational).toBe(true);
      expect(error.timestamp).toBeDefined();
    });
  });

  describe('static methods', () => {
    it('should create badRequest error', () => {
      const error = ApiError.badRequest('Invalid input');

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Invalid input');
    });

    it('should create unauthorized error', () => {
      const error = ApiError.unauthorized('Token required');

      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Token required');
    });

    it('should create forbidden error', () => {
      const error = ApiError.forbidden('Access denied');

      expect(error.statusCode).toBe(403);
    });

    it('should create notFound error', () => {
      const error = ApiError.notFound('Resource not found');

      expect(error.statusCode).toBe(404);
    });

    it('should create internal error', () => {
      const error = ApiError.internal();

      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(false);
    });
  });
});
