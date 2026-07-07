'use strict';

const express = require('express');
const router  = express.Router();
const { getHealthStatus } = require('./health.controller');
const { verifyToken, requireAdmin } = require('../../../middleware/authMiddleware');

router.get('/status', verifyToken, requireAdmin, getHealthStatus);

module.exports = router;
