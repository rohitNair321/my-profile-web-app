// api/v1/auth/auth.controller.js
const authService = require('../../../services/authService');
const { logActivity } = require('../../../services/activityService');
const ApiResponse = require('../../../utils/ApiResponse');
const catchAsync = require('../../../utils/catchAsync');
const { COOKIE } = require('../../../config/constants');

const isProduction = process.env.NODE_ENV === 'production';

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user (Admin only)
 * @access  Public
 */
const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  const { token, user } = await authService.login(email, password);

  logActivity({
    userId:    user.id,
    eventType: 'login',
    entity:    'auth',
    meta: {
      browser: req.headers['user-agent'] || null,
      ip:      req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
    },
  });

  // Set httpOnly cookie
  res.cookie(COOKIE.TOKEN_NAME, token, {
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
    maxAge: COOKIE.MAX_AGE,
    path: '/',
  });

  const response = ApiResponse.success(
    { user, token },
    'Login successful'
  );

  res.status(response.statusCode).json(response);
});

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user
 * @access  Private
 */
const logout = catchAsync(async (req, res) => {
  // Clear cookie
  res.clearCookie(COOKIE.TOKEN_NAME, {
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
    path: '/',
  });

  const result = authService.logout();
  const response = ApiResponse.success(null, result.message);

  res.status(response.statusCode).json(response);
});

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;

  const result = await authService.forgotPassword(email);
  const response = ApiResponse.success(null, result.message);

  res.status(response.statusCode).json(response);
});

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password with OTP
 * @access  Public
 */
const resetPassword = catchAsync(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  const result = await authService.resetPassword(email, otp, newPassword);
  const response = ApiResponse.success(null, result.message);

  res.status(response.statusCode).json(response);
});

/**
 * @route   PUT /api/v1/auth/update-password
 * @desc    Update password (logged in user)
 * @access  Private
 */
const updatePassword = catchAsync(async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;

  const result = await authService.updatePassword(
    email,
    currentPassword,
    newPassword
  );

  logActivity({
    userId:    req.user?.id,
    eventType: 'password_update',
    entity:    'auth',
    meta:      { updatedAt: result.passwordUpdatedAt ?? new Date().toISOString() },
  });

  const response = ApiResponse.success(null, result.message);

  res.status(response.statusCode).json(response);
});

/**
 * @route   GET /api/v1/auth/init
 * @desc    Initialize app data (on frontend load)
 * @access  Public (with optional auth)
 */
const initApp = catchAsync(async (req, res) => {
  const user = req.user; // Set by optionalAuth middleware

  // Refresh cookie if user is authenticated
  if (user && user.role !== 'guest') {
    const token =
      req.cookies?.[COOKIE.TOKEN_NAME] ||
      req.headers.authorization?.split(' ')[1];

    if (token) {
      res.cookie(COOKIE.TOKEN_NAME, token, {
        httpOnly: true,
        sameSite: isProduction ? 'none' : 'lax',
        secure: isProduction,
        maxAge: COOKIE.MAX_AGE,
        path: '/',
      });
    }
  }

  const data = await authService.initAppData(user);
  const response = ApiResponse.success(data, 'App initialized');

  res.status(response.statusCode).json(response);
});

/**
 * @route   GET /api/v1/auth/password-status
 * @desc    Return password expiry status for the logged-in admin
 * @access  Admin
 */
const getPasswordStatus = catchAsync(async (req, res) => {
  const status   = await authService.getPasswordStatus(req.user.id);
  const response = ApiResponse.success(status, 'Password status retrieved');
  res.status(response.statusCode).json(response);
});

module.exports = {
  login,
  logout,
  forgotPassword,
  resetPassword,
  updatePassword,
  getPasswordStatus,
  initApp,
};
