// utils/ApiResponse.js

/**
 * Standardized API Response Format
 * Ensures all API responses follow the same structure
 */
class ApiResponse {
  constructor(statusCode, data, message = 'Success') {
    this.success = statusCode < 400;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Success response helper
   */
  static success(data, message = 'Success', statusCode = 200) {
    return new ApiResponse(statusCode, data, message);
  }

  /**
   * Created response helper (201)
   */
  static created(data, message = 'Resource created successfully') {
    return new ApiResponse(201, data, message);
  }

  /**
   * No content response helper (204)
   */
  static noContent(message = 'No content') {
    return new ApiResponse(204, null, message);
  }
}

module.exports = ApiResponse;
