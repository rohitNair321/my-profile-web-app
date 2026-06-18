// api/v1/analytics/analytics.routes.js
const express = require('express');
const router = express.Router();
const analyticsController = require('./analytics.controller');
const { verifyToken, requireAdmin } = require('../../../middleware/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Analytics
 *   description: Google Analytics dashboard endpoints (Admin only)
 */

/**
 * All analytics routes require admin authentication
 */
router.use(verifyToken, requireAdmin);

/**
 * @swagger
 * /api/v1/analytics/dashboard:
 *   get:
 *     summary: Get complete analytics dashboard
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *         description: Start date (e.g., '7daysAgo', '30daysAgo', '2024-01-01')
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *         description: End date (default 'today')
 *     responses:
 *       200:
 *         description: Dashboard data retrieved
 */
router.get('/dashboard', analyticsController.getDashboard);

/**
 * @swagger
 * /api/v1/analytics/pageviews:
 *   get:
 *     summary: Get page views over time
 *     tags: [Analytics]
 */
router.get('/pageviews', analyticsController.getPageViews);

/**
 * @swagger
 * /api/v1/analytics/visitors:
 *   get:
 *     summary: Get visitor statistics
 *     tags: [Analytics]
 */
router.get('/visitors', analyticsController.getVisitorStats);

/**
 * @swagger
 * /api/v1/analytics/geographic:
 *   get:
 *     summary: Get geographic data (countries, cities)
 *     tags: [Analytics]
 */
router.get('/geographic', analyticsController.getGeographic);

/**
 * @swagger
 * /api/v1/analytics/devices:
 *   get:
 *     summary: Get device types data
 *     tags: [Analytics]
 */
router.get('/devices', analyticsController.getDevices);

/**
 * @swagger
 * /api/v1/analytics/traffic:
 *   get:
 *     summary: Get traffic sources
 *     tags: [Analytics]
 */
router.get('/traffic', analyticsController.getTraffic);

/**
 * @swagger
 * /api/v1/analytics/pages:
 *   get:
 *     summary: Get top pages
 *     tags: [Analytics]
 */
router.get('/pages', analyticsController.getTopPages);

module.exports = router;
