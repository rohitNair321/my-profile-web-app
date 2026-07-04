'use strict';

const express = require('express');
const router  = express.Router();
const { listFiles, deleteFile } = require('./storage.controller');
const { verifyToken, requireAdmin } = require('../../../middleware/authMiddleware');

router.get   ('/files', verifyToken, requireAdmin, listFiles);
router.delete('/files', verifyToken, requireAdmin, deleteFile);

module.exports = router;
