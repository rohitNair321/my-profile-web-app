// routes/authRoutes.js
const express = require('express');
const { loginUser, forgotPassword, resetPassword, updatePassword, logout, initAppData } = require('../controllers/authController');
const { verifyToken, requireAdmin, optionalAuth } = require('../middleware/authVerify');
const router = express.Router();

// /api/auth/register
// router.post('/register', registerUser);
// /api/auth/login

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: User authentication and password management
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate user and return JWT token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 */
router.post('/login', loginUser);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user's profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 */
router.get("/initApp", optionalAuth, initAppData);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Generate password reset OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@example.com
 *     responses:
 *       200:
 *         description: Reset OTP generated and logged to the server console if the email exists
 */
router.post('/forgot-password', forgotPassword);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset user password with OTP
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
 *                 example: NewSecurePass123
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: OTP expired or invalid
 */
router.post('/reset-password', resetPassword);

/**
 * @swagger
 * /api/auth/update-password:
 *   put:
 *     summary: Update admin password
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
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
 *       401:
 *         description: Current password incorrect
 */
router.put('/update-password', verifyToken, requireAdmin, updatePassword);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user and invalidate JWT token
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', logout);

module.exports = router;
