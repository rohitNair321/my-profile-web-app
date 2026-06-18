// api/v1/posts/post.routes.js
'use strict';

const express    = require('express');
const multer     = require('multer');
const router     = express.Router();
const upload     = multer({ storage: multer.memoryStorage() });

const { verifyToken, requireAdmin, optionalAuth } = require('../../../middleware/authVerify');
const {
  getAllPublished,
  getFeatured,
  getBySlug,
  trackView,
  getAllAdmin,
  create,
  update,
  updateImpressions,
  deletePost,
  uploadCover,
} = require('./post.controller');

// ─────────────────────────────────────────────────────────────────
//  SWAGGER DOCS
// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   - name: Posts
 *     description: Blog / LinkedIn post management
 */

/**
 * @swagger
 * /api/v1/posts:
 *   get:
 *     summary: Get all published posts (paginated)
 *     tags: [Posts]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 12 }
 *       - in: query
 *         name: tag
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of published posts
 */
router.get('/', getAllPublished);

/**
 * @swagger
 * /api/v1/posts/featured:
 *   get:
 *     summary: Get featured posts (for homepage)
 *     tags: [Posts]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 3 }
 *     responses:
 *       200:
 *         description: List of featured posts
 */
router.get('/featured', getFeatured);

/**
 * @swagger
 * /api/v1/posts/admin/all:
 *   get:
 *     summary: Get all posts including drafts (admin only)
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [draft, published, archived] }
 *     responses:
 *       200:
 *         description: All posts
 *       401:
 *         description: Unauthorized
 */
router.get('/admin/all', verifyToken, requireAdmin, getAllAdmin);

/**
 * @swagger
 * /api/v1/posts/upload/cover:
 *   post:
 *     summary: Upload a cover image (admin only)
 *     tags: [Posts]
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
 *               cover:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Returns { url, path } of uploaded image
 *       400:
 *         description: No file provided
 */
router.post('/upload/cover', verifyToken, requireAdmin, upload.single('cover'), uploadCover);

/**
 * @swagger
 * /api/v1/posts/slug/{slug}:
 *   get:
 *     summary: Get a published post by slug
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Post data
 *       404:
 *         description: Post not found
 */
router.get('/slug/:slug', getBySlug);

/**
 * @swagger
 * /api/v1/posts:
 *   post:
 *     summary: Create a new post (admin only)
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, content]
 *             properties:
 *               title:           { type: string }
 *               content:         { type: string, description: HTML from rich editor }
 *               content_raw:     { type: string, description: Plain text version }
 *               excerpt:         { type: string }
 *               status:          { type: string, enum: [draft, published, archived] }
 *               is_featured:     { type: boolean }
 *               week_number:     { type: integer }
 *               tags:            { type: array, items: { type: string } }
 *               cover_image_url: { type: string }
 *               linkedin_url:    { type: string }
 *               seo_title:       { type: string }
 *               seo_description: { type: string }
 *               og_image_url:    { type: string }
 *     responses:
 *       201:
 *         description: Post created
 */
router.post('/', verifyToken, requireAdmin, create);

/**
 * @swagger
 * /api/v1/posts/{id}:
 *   put:
 *     summary: Update a post (admin only)
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Updated post
 */
router.put('/:id', verifyToken, requireAdmin, update);

/**
 * @swagger
 * /api/v1/posts/{id}/impressions:
 *   patch:
 *     summary: Update LinkedIn impression count (admin only)
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               impressions: { type: integer }
 *     responses:
 *       200:
 *         description: Impressions updated
 */
router.patch('/:id/impressions', verifyToken, requireAdmin, updateImpressions);

/**
 * @swagger
 * /api/v1/posts/{id}:
 *   delete:
 *     summary: Delete a post (admin only)
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Post deleted
 */
router.delete('/:id', verifyToken, requireAdmin, deletePost);

/**
 * @swagger
 * /api/v1/posts/{id}/view:
 *   post:
 *     summary: Track a page view for a post
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: View tracked
 */
router.post('/:id/view', trackView);

module.exports = router;
