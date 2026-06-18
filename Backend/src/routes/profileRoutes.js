const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer(); // memory storage - keeps files in buffer
const { verifyToken, requireAdmin, allowPublic, optionalAuth } = require('../middleware/authVerify');
const {
  getMyProfile,
  updateMyProfile,
  downloadResume,
  deleteResume,
} = require('../controllers/profileController');

/**
 * @swagger
 * /api/profile/getMyProfile:
 *   get:
 *     summary: Retrieve public profile data
 *     tags: [Profile]
 *     responses:
 *       200:
 *         description: Profile data retrieved successfully
 */
/**
 * @swagger
 * /api/profile/saveUpdateMyProfile:
 *   put:
 *     summary: Update portfolio profile including themes (Admin only — legacy path)
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
 *                 example: Rohit Nair
 *               email:
 *                 type: string
 *               description:
 *                 type: string
 *               location:
 *                 type: string
 *               linkedin:
 *                 type: string
 *               github:
 *                 type: string
 *               logo_initials:
 *                 type: string
 *               openToWork:
 *                 type: string
 *                 enum: [true, false]
 *               currenttheme:
 *                 type: string
 *                 description: Theme name to apply on load
 *                 example: Golden Hour
 *               skills:
 *                 type: string
 *                 description: JSON array of skills
 *                 example: '["Angular","Node.js","TypeScript"]'
 *               experiences:
 *                 type: string
 *                 description: JSON array of experience objects
 *                 example: '[]'
 *               themes:
 *                 type: string
 *                 description: >
 *                   JSON-stringified array of theme definitions.
 *                   Paste the full themes array JSON here (as a string).
 *                 example: >
 *                   [{"id":"golden-hour","name":"Golden Hour","tokens":{"primary":"#C0572B","accent":"#E8893C","primary_glow":"rgba(192,87,43,0.16)","background":"#FDF7F0","surface":"#FFFBF7","surface_alt":"#FFF4EB","text_primary":"#1E1008","text_secondary":"#5C3A24","text_muted":"#9B6B52","border":"#E8CDB8","success":"#3D8B5E","warning":"#C07A14","error":"#C03030","transition_speed":"0.3s"},"dark_tokens":{"primary":"#E8923A","accent":"#F5B84A","primary_glow":"rgba(232,146,58,0.20)","background":"#1A110A","surface":"#251810","surface_alt":"#321F15","text_primary":"#F5EDE4","text_secondary":"#C0987A","text_muted":"#7A584A","border":"#4A2E1E","success":"#5BA870","warning":"#E8A030","error":"#E05545","transition_speed":"0.3s"}}]
 *               avatar:
 *                 type: string
 *                 format: binary
 *               resume:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile updated
 *       401:
 *         description: Unauthorized
 */
router.get('/getMyProfile', optionalAuth, getMyProfile);
router.put('/saveUpdateMyProfile', verifyToken, requireAdmin, upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'resume', maxCount: 1 }
]), updateMyProfile);

/**
 * @swagger
 * /api/profile/me/resume:
 *   get:
 *     summary: Download resume (Admin only)
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resume download link
 */
router.get('/me/resume', verifyToken, requireAdmin, downloadResume);
router.delete('/me/resume', verifyToken, requireAdmin, deleteResume);

module.exports = router;
