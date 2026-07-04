// api/v1/contact/contact.routes.js
const express = require('express');
const router = express.Router();
const contactController = require('../../../controllers/contactController');
const { contactValidators, validate } = require('../../../utils/validators');
const { apiLimiter } = require('../../../middleware/rateLimiter');
const { verifyToken, requireAdmin, optionalAuth } = require('../../../middleware/authVerify');

/**
 * @swagger
 * tags:
 *   name: Contact
 *   description: Contact form endpoints
 */

/**
 * @swagger
 * /api/v1/contact:
 *   post:
 *     summary: Submit contact form
 *     tags: [Contact]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - subject
 *               - message
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               subject:
 *                 type: string
 *                 example: Inquiry about collaboration
 *               message:
 *                 type: string
 *                 example: I would like to discuss a project opportunity
 *     responses:
 *       200:
 *         description: Contact form submitted
 */
router.post(
  '/',
  apiLimiter,
  validate(contactValidators.contactForm),
  contactController.submitContactForm || ((req, res) => {
    res.json({ message: 'Contact form endpoint - implement in contactController' });
  })
);

// ── Migrated from legacy /api/contact/* (same controller — identical contracts) ──

/**
 * @swagger
 * /api/v1/contact/send:
 *   post:
 *     summary: Submit contact form (firstName/lastName/email/message)
 *     tags: [Contact]
 *     responses:
 *       200: { description: Message submitted successfully }
 */
router.post('/send', optionalAuth, contactController.submitContactForm);

/**
 * @swagger
 * /api/v1/contact/notifications:
 *   get:
 *     summary: Get all contact notifications (Admin only)
 *     tags: [Contact]
 *     security: [{ bearerAuth: [] }, { cookieAuth: [] }]
 *     responses:
 *       200: { description: "{ success, notificationList, unreadCount }" }
 */
router.get('/notifications', verifyToken, requireAdmin, contactController.getNotifications);

/**
 * @swagger
 * /api/v1/contact/notifications/{id}/read:
 *   put:
 *     summary: Mark a contact notification as read (Admin only)
 *     tags: [Contact]
 *     security: [{ bearerAuth: [] }, { cookieAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Updated notification list }
 */
router.put('/notifications/:id/read', verifyToken, requireAdmin, contactController.markAsRead);

/**
 * @swagger
 * /api/v1/contact/delete/{id}:
 *   delete:
 *     summary: Delete a contact message (Admin only)
 *     tags: [Contact]
 *     security: [{ bearerAuth: [] }, { cookieAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Updated notification list }
 */
router.delete('/delete/:id', verifyToken, requireAdmin, contactController.deleteContactMessage);

module.exports = router;
