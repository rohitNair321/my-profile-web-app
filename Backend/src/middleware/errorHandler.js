// middleware/errorHandler.js
const logger = require('../config/logger');
const { HTTP_STATUS } = require('../config/constants');
const ApiError = require('../utils/ApiError');

/**
 * Convert non-ApiError errors to ApiError
 */
const errorConverter = (err, req, res, next) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
    const message = error.message || 'Internal Server Error';
    error = new ApiError(statusCode, message, false, err.stack);
  }

  next(error);
};

/**
 * Global error handler
 * Logs errors and sends appropriate response
 */
const errorHandler = (err, req, res, next) => {
  let { statusCode, message, stack } = err;

  // Default to 500 if statusCode is not set
  statusCode = statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;

  const isProduction = process.env.NODE_ENV === 'production';

  // Log error
  const logData = {
    statusCode,
    message,
    method: req.method,
    url: req.url,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
  };

  if (statusCode >= 500) {
    logger.error('Server Error:', { ...logData, stack });
  } else {
    logger.warn('Client Error:', logData);
  }

  // Prepare response
  const response = {
    success: false,
    statusCode,
    message,
    timestamp: new Date().toISOString(),
  };

  // Include stack trace in development
  if (!isProduction && stack) {
    response.stack = stack;
  }

  // Send error response
  res.status(statusCode).json(response);
};

/**
 * Handle 404 - Not Found
 */
const notFound = (req, res, next) => {
  const error = ApiError.notFound(`Route not found: ${req.originalUrl}`);
  next(error);
};

module.exports = {
  errorConverter,
  errorHandler,
  notFound,
};
