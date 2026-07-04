// api/v1/auth/auth.routes.js
const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { authValidators, validate } = require('../../../utils/validators');
const { verifyToken, optionalAuth, requireAdmin } = require('../../../middleware/authMiddleware');
const { authLimiter } = require('../../../middleware/rateLimiter');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication endpoints
 */

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login user (Admin only)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePass123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/login',
  authLimiter,
  validate(authValidators.login),
  authController.login
);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', verifyToken, authController.logout);

/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: Generate password reset OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@example.com
 *     responses:
 *       200:
 *         description: Reset OTP generated and logged to the server console if the email exists
 */
router.post(
  '/forgot-password',
  authLimiter,
  validate(authValidators.forgotPassword),
  authController.forgotPassword
);

/**
 * @swagger
 * /api/v1/auth/reset-password:
 *   post:
 *     summary: Reset password with OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@example.com
 *               otp:
 *                 type: string
 *                 example: "123456"
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 example: NewSecurePass123
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: OTP expired or invalid
 *       422:
 *         description: Validation error
 */
router.post(
  '/reset-password',
  validate(authValidators.resetPassword),
  authController.resetPassword
);

/**
 * @swagger
 * /api/v1/auth/update-password:
 *   put:
 *     summary: Update password (logged in user)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password updated successfully
 */
router.put(
  '/update-password',
  verifyToken,
  validate(authValidators.updatePassword),
  authController.updatePassword
);

/**
 * @swagger
 * /api/v1/auth/password-status:
 *   get:
 *     summary: Get password expiry status
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Password status returned
 */
router.get('/password-status', verifyToken, requireAdmin, authController.getPasswordStatus);

/**
 * @swagger
 * /api/v1/auth/init:
 *   get:
 *     summary: Initialize app data
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: App data retrieved
 */
router.get('/init', optionalAuth, authController.initApp);

module.exports = router;
