// middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const { RATE_LIMIT } = require('../config/constants');
const logger = require('../config/logger');

/**
 * General API rate limiter
 * Prevents abuse by limiting requests per IP
 */
const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT.API_WINDOW_MINUTES * 60 * 1000,
  max: RATE_LIMIT.API_MAX_REQUESTS,

  skip: (req) => {
    const allowedHosts = [
      'rohit-nair296.onrender.com',
      'localhost',
      '127.0.0.1'
    ];

    const host = req.headers.host?.split(':')[0]; // Remove port
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();
    const isInitEndpoint = req.path === '/api/v1/auth/init';

    // ✅ Always skip /init endpoint (critical for app startup)
    if (isInitEndpoint) {
      return true;
    }

    // ✅ Skip SSR requests (Node/Angular SSR)
    if (userAgent.includes('node') || userAgent.includes('axios')) {
      return true;
    }

    // ✅ Skip your own frontend domains
    if (allowedHosts.some(allowedHost => host?.includes(allowedHost))) {
      return true;
    }

    return false;
  },

  message: {
    success: false,
    statusCode: 429,
    message: `Too many requests from this IP, please try again after ${RATE_LIMIT.API_WINDOW_MINUTES} minutes`,
    timestamp: new Date().toISOString(),
  },

  standardHeaders: true,
  legacyHeaders: false,

  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      url: req.url,
      host: req.headers.host,
      userAgent: req.headers['user-agent'],
    });

    res.status(429).json({
      success: false,
      statusCode: 429,
      message: `Too many requests, please try again after ${RATE_LIMIT.API_WINDOW_MINUTES} minutes`,
      timestamp: new Date().toISOString(),
    });
  },
});

/**
 * Strict rate limiter for auth endpoints
 * More restrictive to prevent brute force attacks
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  skipSuccessfulRequests: true,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many login attempts, please try again after 15 minutes',
    timestamp: new Date().toISOString(),
  },
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      url: req.url,
    });
    res.status(429).json({
      success: false,
      statusCode: 429,
      message: 'Too many login attempts, please try again after 15 minutes',
      timestamp: new Date().toISOString(),
    });
  },
});

/**
 * Chat rate limiter
 * Specific to chat endpoints
 */
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 messages per minute
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many messages, please slow down',
    timestamp: new Date().toISOString(),
  },
  handler: (req, res) => {
    logger.warn('Chat rate limit exceeded', {
      ip: req.ip,
      user: req.user?.email || 'guest',
    });
    res.status(429).json({
      success: false,
      statusCode: 429,
      message: 'Too many messages, please slow down',
      timestamp: new Date().toISOString(),
    });
  },
});

module.exports = {
  apiLimiter,
  authLimiter,
  chatLimiter,
};
