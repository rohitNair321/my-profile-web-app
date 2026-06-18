// tests/unit/utils/ApiResponse.test.js
const ApiResponse = require('../../../src/utils/ApiResponse');

describe('ApiResponse', () => {
  describe('constructor', () => {
    it('should create success response with statusCode < 400', () => {
      const response = new ApiResponse(200, { id: 1 }, 'Success');

      expect(response.success).toBe(true);
      expect(response.statusCode).toBe(200);
      expect(response.message).toBe('Success');
      expect(response.data).toEqual({ id: 1 });
      expect(response.timestamp).toBeDefined();
    });

    it('should create error response with statusCode >= 400', () => {
      const response = new ApiResponse(400, null, 'Bad Request');

      expect(response.success).toBe(false);
      expect(response.statusCode).toBe(400);
      expect(response.message).toBe('Bad Request');
    });
  });

  describe('static methods', () => {
    it('should create success response', () => {
      const response = ApiResponse.success({ id: 1 }, 'Operation successful');

      expect(response.success).toBe(true);
      expect(response.statusCode).toBe(200);
      expect(response.message).toBe('Operation successful');
    });

    it('should create created response', () => {
      const response = ApiResponse.created({ id: 1 });

      expect(response.success).toBe(true);
      expect(response.statusCode).toBe(201);
    });

    it('should create no content response', () => {
      const response = ApiResponse.noContent();

      expect(response.success).toBe(true);
      expect(response.statusCode).toBe(204);
    });
  });
});
