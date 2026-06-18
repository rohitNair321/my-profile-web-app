// api/v1/contact/contact.routes.js
const express = require('express');
const router = express.Router();
const contactController = require('../../../controllers/contactController');
const { contactValidators, validate } = require('../../../utils/validators');
const { apiLimiter } = require('../../../middleware/rateLimiter');

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

module.exports = router;
