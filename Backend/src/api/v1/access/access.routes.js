// api/v1/access/access.routes.js
'use strict';

const express = require('express');
const router = express.Router();

const { verifyToken, requireAdmin, requireSuperAdmin } = require('../../../middleware/authVerify');
const accessController = require('./access.controller');

/**
 * @swagger
 * tags:
 *   - name: Access
 *     description: Role-based page access & user provisioning (super-admin console)
 */

// Every access route requires a valid token.
router.use(verifyToken);

/**
 * @swagger
 * /api/v1/access/my-pages:
 *   get:
 *     summary: The signed-in user's effective accessible page keys
 *     tags: [Access]
 *     security: [{ bearerAuth: [] }, { cookieAuth: [] }]
 *     responses:
 *       200: { description: "{ role, pages: string[] }" }
 */
router.get('/my-pages', accessController.myPages);

/**
 * @swagger
 * /api/v1/access/pages:
 *   get:
 *     summary: Grantable page registry (admin+)
 *     tags: [Access]
 *     security: [{ bearerAuth: [] }, { cookieAuth: [] }]
 *     responses:
 *       200: { description: Grantable pages }
 */
router.get('/pages', requireAdmin, accessController.listPages);

// ── Super-admin-only user provisioning + grants ────────────────────
router.use(requireSuperAdmin);

/**
 * @swagger
 * /api/v1/access/users:
 *   get:
 *     summary: List users with their granted pages (super admin)
 *     tags: [Access]
 *     security: [{ bearerAuth: [] }, { cookieAuth: [] }]
 *     responses:
 *       200: { description: Users with access }
 *   post:
 *     summary: Provision a user by email — generates + emails a temp password (super admin)
 *     tags: [Access]
 *     security: [{ bearerAuth: [] }, { cookieAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *               role:  { type: string, enum: [admin, user] }
 *               pages: { type: array, items: { type: string } }
 *     responses:
 *       201: { description: "{ user, tempPassword } — tempPassword shown once" }
 *       409: { description: Email already exists }
 */
router.get('/users', accessController.listUsers);
router.post('/users', accessController.createUser);

/**
 * @swagger
 * /api/v1/access/users/{id}/access:
 *   patch:
 *     summary: Replace a user's page grants (super admin)
 *     tags: [Access]
 *     security: [{ bearerAuth: [] }, { cookieAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Updated grants }
 */
router.patch('/users/:id/access', accessController.updateAccess);

/**
 * @swagger
 * /api/v1/access/users/{id}/status:
 *   patch:
 *     summary: Enable / disable a user (super admin)
 *     tags: [Access]
 *     security: [{ bearerAuth: [] }, { cookieAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Updated user }
 */
router.patch('/users/:id/status', accessController.setStatus);

/**
 * @swagger
 * /api/v1/access/users/{id}/config:
 *   patch:
 *     summary: Set which admin sections a user sees (super admin)
 *     tags: [Access]
 *     security: [{ bearerAuth: [] }, { cookieAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               config:
 *                 type: object
 *                 properties:
 *                   showSidebarToggle:   { type: boolean }
 *                   showAgentChat:       { type: boolean }
 *                   showUserProfileView: { type: boolean }
 *                   showNotifications:   { type: boolean }
 *     responses:
 *       200: { description: Updated config }
 */
router.patch('/users/:id/config', accessController.setConfig);

module.exports = router;
