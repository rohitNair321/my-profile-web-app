// api/v1/activity/activity.routes.js
const express = require('express');
const router = express.Router();
const { getFeed, getLogins, getFieldChanges, getSummary, deleteLog, deleteAllLogs } = require('./activity.controller');
const { verifyToken, requireAdmin, optionalAuth } = require('../../../middleware/authMiddleware');

// Public — sanitised aggregate stats
router.get('/summary', optionalAuth, getSummary);

// Admin-only reads
router.get('/feed',          verifyToken, requireAdmin, getFeed);
router.get('/logins',        verifyToken, requireAdmin, getLogins);
router.get('/field-changes', verifyToken, requireAdmin, getFieldChanges);

// Admin-only deletes
router.delete('/logs',     verifyToken, requireAdmin, deleteAllLogs);
router.delete('/logs/:id', verifyToken, requireAdmin, deleteLog);

module.exports = router;
