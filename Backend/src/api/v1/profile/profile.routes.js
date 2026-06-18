// api/v1/profile/profile.routes.js
const express = require('express');
const multer  = require('multer');
const router  = express.Router();

const { getMyProfile, updateMyProfile, downloadResume, deleteResume } = require('../../../controllers/profileController');
const { verifyToken, requireAdmin, optionalAuth } = require('../../../middleware/authMiddleware');

// Memory-storage multer — handles avatar + resume file uploads
const upload = multer();

/**
 * @swagger
 * tags:
 *   name: Profile
 *   description: Portfolio profile management
 */

/**
 * @swagger
 * /api/v1/profile:
 *   get:
 *     summary: Get portfolio profile (public)
 *     tags: [Profile]
 *     responses:
 *       200:
 *         description: Profile data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profile:
 *                   type: object
 */
router.get('/', optionalAuth, getMyProfile);

/**
 * @swagger
 * /api/v1/profile:
 *   put:
 *     summary: Update portfolio profile (Admin only)
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Full name
 *                 example: Rohit Nair
 *               description:
 *                 type: string
 *                 description: Professional bio
 *               email:
 *                 type: string
 *                 format: email
 *               location:
 *                 type: string
 *                 example: Pune, India
 *               linkedin:
 *                 type: string
 *               github:
 *                 type: string
 *               website:
 *                 type: string
 *               logo_initials:
 *                 type: string
 *                 maxLength: 3
 *                 example: RN
 *               openToWork:
 *                 type: boolean
 *                 example: true
 *               currenttheme:
 *                 type: string
 *                 description: Name of the currently active theme
 *                 example: Golden Hour
 *               skills:
 *                 type: string
 *                 description: JSON-stringified array of skill strings
 *                 example: '["Angular","Node.js","TypeScript"]'
 *               experiences:
 *                 type: string
 *                 description: JSON-stringified array of experience objects
 *                 example: '[]'
 *               themes:
 *                 type: string
 *                 description: >
 *                   JSON-stringified array of ThemeDefinition objects.
 *                   Each theme has id, name, tokens (light), and dark_tokens (dark).
 *                 example: >
 *                   [{"id":"golden-hour","name":"Golden Hour","tokens":{"primary":"#C0572B","accent":"#E8893C","primary_glow":"rgba(192,87,43,0.16)","background":"#FDF7F0","surface":"#FFFBF7","surface_alt":"#FFF4EB","text_primary":"#1E1008","text_secondary":"#5C3A24","text_muted":"#9B6B52","border":"#E8CDB8","success":"#3D8B5E","warning":"#C07A14","error":"#C03030","transition_speed":"0.3s"},"dark_tokens":{"primary":"#E8923A","accent":"#F5B84A","primary_glow":"rgba(232,146,58,0.20)","background":"#1A110A","surface":"#251810","surface_alt":"#321F15","text_primary":"#F5EDE4","text_secondary":"#C0987A","text_muted":"#7A584A","border":"#4A2E1E","success":"#5BA870","warning":"#E8A030","error":"#E05545","transition_speed":"0.3s"}}]
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Profile image (JPG, PNG)
 *               resume:
 *                 type: string
 *                 format: binary
 *                 description: Resume file (PDF only)
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profile:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin only
 */
router.put(
  '/',
  verifyToken,
  requireAdmin,
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'resume', maxCount: 1 },
  ]),
  updateMyProfile
);

/**
 * @swagger
 * /api/v1/profile/resume:
 *   get:
 *     summary: Get signed download URL for resume (Admin only)
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Signed URL returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                 expires_in:
 *                   type: integer
 *                   example: 600
 *       404:
 *         description: No resume on file
 */
router.get('/resume', verifyToken, requireAdmin, downloadResume);

/**
 * @swagger
 * /api/v1/profile/resume:
 *   delete:
 *     summary: Delete resume from storage and clear profile (Admin only)
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Resume deleted, updated profile returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profile:
 *                   type: object
 *       404:
 *         description: No resume on file
 */
router.delete('/resume', verifyToken, requireAdmin, deleteResume);

module.exports = router;
