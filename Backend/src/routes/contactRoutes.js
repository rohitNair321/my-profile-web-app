const express = require('express');
const router = express.Router();
const { submitContactForm, getNotifications, markAsRead, deleteContactMessage }  = require('../controllers/contactController');
const { verifyToken, optionalAuth, requireAdmin } = require('../middleware/authVerify');

/**
 * @swagger
 * tags:
 *   - name: Contact
 *     description: Contact form and notification management
 */

/**
 * @swagger
 * /api/contact/send:
 *   post:
 *     summary: Submit contact form
 *     tags: [Contact]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Message submitted successfully
 */
router.post('/send', optionalAuth, submitContactForm);

/**
 * @swagger
 * /api/contact/notifications:
 *   get:
 *     summary: Get all contact notifications (Admin only)
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of contact notifications
 */
router.get('/notifications', verifyToken, requireAdmin, getNotifications);

/**
 * @swagger
 * /api/contact/notifications/{id}/read:
 *   put:
 *     summary: Mark a contact notification as read (Admin only)
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as read
 */
router.put('/notifications/:id/read', verifyToken, requireAdmin, markAsRead);

/**
 * @swagger
 * /api/contact/delete/{id}:
 *   delete:
 *     summary: Delete a contact message (Admin only)
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contact message deleted successfully
 */
router.delete('/delete/:id', verifyToken, requireAdmin, deleteContactMessage);

module.exports = router;