// api/v1/index.js
const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes     = require('./auth/auth.routes');
const chatRoutes     = require('./chat/chat.routes');
const profileRoutes  = require('./profile/profile.routes');
const contactRoutes  = require('./contact/contact.routes');
const analyticsRoutes = require('./analytics/analytics.routes');
const postRoutes      = require('./posts/post.routes');
const activityRoutes  = require('./activity/activity.routes');
const storageRoutes   = require('./storage/storage.routes');
const healthRoutes    = require('./health/health.routes');
const taskRoutes      = require('./tasks/task.routes');

// Mount routes
router.use('/auth',      authRoutes);
router.use('/chat',      chatRoutes);
router.use('/profile',   profileRoutes);
router.use('/contact',   contactRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/posts',     postRoutes);
router.use('/activity',  activityRoutes);
router.use('/storage',   storageRoutes);
router.use('/health',    healthRoutes);
router.use('/tasks',     taskRoutes);

// API v1 health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    statusCode: 200,
    message: 'API v1 is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
