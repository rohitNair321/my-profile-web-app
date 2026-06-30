// api/v1/activity/activity.routes.js
const express = require('express');
const router = express.Router();
const { getFeed, getLogins, getFieldChanges, getSummary } = require('./activity.controller');
const { verifyToken, requireAdmin, optionalAuth } = require('../../../middleware/authMiddleware');

// Public — sanitised aggregate stats
router.get('/summary', optionalAuth, getSummary);

// Admin-only
router.get('/feed',          verifyToken, requireAdmin, getFeed);
router.get('/logins',        verifyToken, requireAdmin, getLogins);
router.get('/field-changes', verifyToken, requireAdmin, getFieldChanges);

module.exports = router;
