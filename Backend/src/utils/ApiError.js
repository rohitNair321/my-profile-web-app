// utils/ApiError.js

/**
 * Custom API Error Class
 * Extends native Error with additional properties
 */
class ApiError extends Error {
  constructor(statusCode, message, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.success = false;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Bad Request (400)
   */
  static badRequest(message = 'Bad Request') {
    return new ApiError(400, message);
  }

  /**
   * Unauthorized (401)
   */
  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message);
  }

  /**
   * Forbidden (403)
   */
  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message);
  }

  /**
   * Not Found (404)
   */
  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  /**
   * Conflict (409)
   */
  static conflict(message = 'Conflict') {
    return new ApiError(409, message);
  }

  /**
   * Internal Server Error (500)
   */
  static internal(message = 'Internal Server Error') {
    return new ApiError(500, message, false);
  }

  /**
   * Validation Error (422)
   */
  static validationError(message = 'Validation Error') {
    return new ApiError(422, message);
  }
}

module.exports = ApiError;
