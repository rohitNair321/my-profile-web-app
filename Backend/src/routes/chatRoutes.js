const experess = require("express");
const router = experess.Router();
const { chat } = require("../controllers/chatController");
const { optionalAuth, verifyToken } = require("../middleware/authVerify");

const {
  createSession,
  saveMessage,
  getSession,
  getSessions,
  deleteSession,
  deleteAllSessions,
  aiUsage,
  balance
} = require("../controllers/chatController");

/**
 * @swagger
 * tags:
 *   - name: Chat
 *     description: Chat functionality for the portfolio website
 */

/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     summary: Chat with AI about portfolio
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: AI response
 */
// router.post('/chat', allowPublic, chat);
router.post("/chat", optionalAuth, chat);


/**
 * @swagger
 * /api/chat/session:
 *   post:
 *     summary: Create chat session
 *     tags: [Chat]
 */
router.post("/createSession",  optionalAuth, createSession);

/**
 * @swagger
 * /api/chat/message:
 *   post:
 *     summary: Save message
 *     tags: [Chat]
 */
router.post("/message",  optionalAuth, saveMessage);

/**
 * @swagger
 * /api/chat/ai-usage:
 *   get:
 *     summary: Get AI usage statistics
 *     tags: [Chat]
 */
router.get("/usage", optionalAuth, aiUsage);

/**
 * @swagger
 * /api/chat/balance:
 *   get:
 *     summary: Get balance
 *     tags: [Chat]
 */
router.get("/balance", optionalAuth, balance);

/**
 * @swagger
 * /api/chat/session/{id}:
 *   get:
 *     summary: Get session messages
 *     tags: [Chat]
 */
router.get("/getSessionById/:id", optionalAuth, getSession);

/**
 * @swagger
 * /api/chat/sessions:
 *   get:
 *     summary: Get all sessions
 *     tags: [Chat]
 */
router.get("/getSessions", optionalAuth, getSessions);

/**
 * @swagger
 * /api/chat/session/{id}:
 *   delete:
 *     summary: Delete chat session
 *     tags: [Chat]
 */
router.delete("/deleteSessionById/:id", optionalAuth, deleteSession);

/**
 * @swagger
 * /api/chat/sessions:
 *   delete:
 *     summary: Delete all chat sessions
 *     tags: [Chat]
 */
router.delete("/deleteAllSessions", optionalAuth, deleteAllSessions);

module.exports = router;