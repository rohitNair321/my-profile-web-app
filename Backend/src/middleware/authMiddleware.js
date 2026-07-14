// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const { USER_ROLES, ADMIN_TIER_ROLES, COOKIE } = require('../config/constants');

const JWT_SECRET = process.env.JWT_SECRET;
const PROFILE_OWNER_ID = process.env.PROFILE_OWNER_ID;
const isProduction = process.env.NODE_ENV === 'production';

/**
 * STRICT Authentication - Requires valid JWT token
 * Used for admin-only routes
 */
const verifyToken = (req, res, next) => {
  try {
    let token = req.cookies?.[COOKIE.TOKEN_NAME];

    // Fallback to Authorization header
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw ApiError.unauthorized('Authorization token required');
    }

    // Verify token
    const payload = jwt.verify(token, JWT_SECRET);
    
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    logger.info('User authenticated', {
      userId: req.user.id,
      role: req.user.role,
    });

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(ApiError.unauthorized('Invalid token'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(ApiError.unauthorized('Token expired'));
    }
    return next(error);
  }
};

/**
 * Require ADMIN-tier role (admin OR super admin — super admin ⊇ admin).
 * Must be used after verifyToken.
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || !ADMIN_TIER_ROLES.includes(req.user.role)) {
    return next(ApiError.forbidden('Admin access required'));
  }
  next();
};

/**
 * Require SUPER ADMIN role. Must be used after verifyToken.
 */
const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== USER_ROLES.SUPER_ADMIN) {
    return next(ApiError.forbidden('Super admin access required'));
  }
  next();
};

/**
 * OPTIONAL Authentication - Works for both authenticated and guest users
 * Identifies user if token exists, otherwise treats as guest
 * Also manages guest session ID via cookie
 */
const optionalAuth = (req, res, next) => {
  try {
    let token = req.cookies?.[COOKIE.TOKEN_NAME];

    // Fallback to Authorization header
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Try to verify token if it exists
    if (token) {
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = {
          id: payload.sub,
          email: payload.email,
          role: payload.role || USER_ROLES.GUEST,
        };

        logger.info('User identified', {
          userId: req.user.id,
          role: req.user.role,
        });

        return next();
      } catch (error) {
        // Token invalid or expired, treat as guest
        logger.warn('Invalid token, treating as guest', {
          error: error.message,
        });
      }
    }

    // Handle guest user
    // Get or create guest ID
    let guestId = req.cookies?.[COOKIE.GUEST_ID_NAME];

    if (!guestId) {
      // Generate new guest ID
      guestId = uuidv4();

      // Set guest ID cookie
      res.cookie(COOKIE.GUEST_ID_NAME, guestId, {
        httpOnly: true,
        sameSite: isProduction ? 'none' : 'lax',
        secure: isProduction,
        maxAge: COOKIE.MAX_AGE,
        path: '/',
      });

      logger.info('New guest session created', { guestId });
    }

    // Set guest user info
    req.user = {
      id: PROFILE_OWNER_ID,
      role: USER_ROLES.GUEST,
      guestId: guestId,
    };

    next();
  } catch (error) {
    logger.error('optionalAuth error:', error);
    // Even if error, allow request to continue as guest
    req.user = {
      id: PROFILE_OWNER_ID,
      role: USER_ROLES.GUEST,
    };
    next();
  }
};

/**
 * Ensure guest ID exists (for chat endpoints)
 * Creates guest ID cookie if it doesn't exist
 */
const ensureGuestId = (req, res, next) => {
  // Authenticated admin-tier users don't need a guest ID
  if (ADMIN_TIER_ROLES.includes(req.user?.role)) {
    return next();
  }

  let guestId = req.cookies?.[COOKIE.GUEST_ID_NAME];

  if (!guestId) {
    guestId = uuidv4();
    res.cookie(COOKIE.GUEST_ID_NAME, guestId, {
      httpOnly: true,
      sameSite: isProduction ? 'none' : 'lax',
      secure: isProduction,
      maxAge: COOKIE.MAX_AGE,
      path: '/',
    });

    logger.info('Guest ID created', { guestId });
  }

  // Attach guest ID to request
  req.guestId = guestId;
  next();
};

module.exports = {
  verifyToken,
  requireAdmin,
  requireSuperAdmin,
  optionalAuth,
  ensureGuestId,
};
