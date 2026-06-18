// api/v1/chat/chat.routes.js
const express = require('express');
const router = express.Router();
const chatController = require('./chat.controller');
// balance is imported via chatController.getBalance
const { chatValidators, validate } = require('../../../utils/validators');
const {
  optionalAuth,
  ensureGuestId,
  verifyToken,
  requireAdmin,
} = require('../../../middleware/authMiddleware');
const { chatLimiter } = require('../../../middleware/rateLimiter');

/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: AI Chat functionality
 */

/**
 * @swagger
 * /api/v1/chat/send:
 *   post:
 *     summary: Send message to AI chatbot
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 example: Tell me about Rohit's experience
 *               sessionId:
 *                 type: string
 *                 format: uuid
 *               userId:
 *                 type: string
 *                 format: uuid
 *               role:
 *                 type: string
 *                 enum: [admin, guest]
 *     responses:
 *       200:
 *         description: AI response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 statusCode:
 *                   type: integer
 *                 data:
 *                   type: object
 *                   properties:
 *                     response:
 *                       type: string
 *                     sessionId:
 *                       type: string
 *                     limitReached:
 *                       type: boolean
 *                     remainingQuestions:
 *                       type: integer
 */
router.post(
  '/send',
  optionalAuth,
  ensureGuestId,
  chatLimiter,
  validate(chatValidators.sendMessage),
  chatController.sendMessage
);

/**
 * @swagger
 * /api/v1/chat/sessions:
 *   get:
 *     summary: Get all chat sessions for user
 *     tags: [Chat]
 *     responses:
 *       200:
 *         description: List of chat sessions
 */
router.get(
  '/sessions',
  optionalAuth,
  ensureGuestId,
  chatController.getSessions
);

/**
 * @swagger
 * /api/v1/chat/sessions/{id}:
 *   get:
 *     summary: Get single chat session
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Chat session details
 */
router.get(
  '/sessions/:id',
  optionalAuth,
  ensureGuestId,
  chatController.getSession
);

/**
 * @swagger
 * /api/v1/chat/sessions/{id}:
 *   delete:
 *     summary: Delete chat session
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Session deleted
 */
router.delete(
  '/sessions/:id',
  optionalAuth,
  ensureGuestId,
  chatController.deleteSession
);

/**
 * @swagger
 * /api/v1/chat/sessions:
 *   delete:
 *     summary: Delete all chat sessions (Admin only)
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: All sessions deleted
 */
router.delete(
  '/sessions',
  verifyToken,
  requireAdmin,
  chatController.deleteAllSessions
);

/**
 * @swagger
 * /api/v1/chat/stats:
 *   get:
 *     summary: Get chat statistics (Admin only)
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Chat statistics
 */
router.get(
  '/stats',
  verifyToken,
  requireAdmin,
  chatController.getChatStats
);

router.get(
  '/balance',
  verifyToken,
  requireAdmin,
  chatController.getBalance
);

module.exports = router;
