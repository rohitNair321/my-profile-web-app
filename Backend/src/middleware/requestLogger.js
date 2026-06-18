// middleware/requestLogger.js
const logger = require('../config/logger');

/**
 * Request logging middleware
 * Logs all incoming requests with details
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Log request
  logger.info(`Incoming Request`, {
    method: req.method,
    url: req.url,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';

    logger[logLevel](`Response Sent`, {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
  });

  next();
};

module.exports = requestLogger;
