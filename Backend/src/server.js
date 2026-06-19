// server.js - Enhanced with comprehensive architecture
require('dotenv').config();

// ============================================
// STARTUP ENV VALIDATION
// ============================================
const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET',
  'PROFILE_OWNER_ID',
  'OPENAI_API_KEY',
];
const missingEnv = REQUIRED_ENV.filter(k => !process.env[k]);
if (missingEnv.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingEnv.join(', ')}`);
  console.error('   Add them to your .env file. See .env.example for reference.');
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('❌ JWT_SECRET must be at least 32 characters for security');
  process.exit(1);
}
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { xss } = require('express-xss-sanitizer');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const path = require('path');

// Import configurations
const logger = require('./config/logger');
const swaggerDocs = require('./config/swagger');
const { testConnection } = require('./config/database');
const { HTTP_STATUS } = require('./config/constants');

// Import middleware
const requestLogger = require('./middleware/requestLogger');
const { apiLimiter } = require('./middleware/rateLimiter');
const {
  errorConverter,
  errorHandler,
  notFound,
} = require('./middleware/errorHandler');

// Import routes
const apiV1Routes = require('./api/v1');
const { supabase: _supabase } = require('./db/supabaseClient');

// Legacy routes (backward compatibility — chat routes removed, auth/profile/contact kept)
const oldAuthRoutes     = require('./routes/authRoutes');
const oldProfileRoutes  = require('./routes/profileRoutes');
const oldContactRoutes  = require('./routes/contactRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// SECURITY MIDDLEWARE
// ============================================
app.use(helmet()); // Set security headers
app.set('trust proxy', 1); // Trust first proxy (for Render, etc.)

// ============================================
// CORS CONFIGURATION
// ============================================
const allowedOrigins = [
  'http://localhost:4200',
  'http://localhost:3000',
  'https://rohitnair321.github.io',
  'https://rohit-nair296.onrender.com',
  'https://portfolio-backend-bpmw.onrender.com',
  'https://rohitnair-dev.onrender.com',
  'https://www.mintpixel.in',
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow server-to-server, Postman, curl (no origin)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    logger.warn('CORS blocked request from origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));

// ============================================
// BODY PARSING & SANITIZATION
// ============================================
app.use(express.json({ limit: '10kb' })); // Limit body size to prevent DoS
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());
app.use(xss()); // Sanitize input to prevent XSS attacks

// ============================================
// LOGGING
// ============================================
if (process.env.NODE_ENV !== 'test') {
  app.use(requestLogger); // Log all requests
}

// ============================================
// API DOCUMENTATION (Swagger)
// ============================================
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Portfolio API Documentation',
}));

logger.info('📚 API Documentation available at /api-docs');

// ============================================
// HEALTH CHECK ENDPOINTS
// ============================================
app.get('/health', (req, res) => {
  res.status(HTTP_STATUS.OK).json({
    success: true,
    statusCode: HTTP_STATUS.OK,
    message: 'Server is running',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health/db', async (req, res) => {
  try {
    const isConnected = await testConnection();

    if (!isConnected) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: 'Database connection failed',
        timestamp: new Date().toISOString(),
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Database connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Database health check failed:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      message: 'Database health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================
// API ROUTES - VERSION 1 (New Architecture)
// ============================================
app.use('/api/v1', apiLimiter, apiV1Routes);

// ============================================
// LEGACY ROUTES (Backward Compatibility)
// ============================================
// Chat routes fully removed — all chat endpoints are now on /api/v1/chat/*
app.use('/api/auth',    oldAuthRoutes);
app.use('/api/profile', oldProfileRoutes);
app.use('/api/contact', oldContactRoutes);

logger.info('🔄 Legacy auth/profile/contact routes mounted for backward compatibility');

// ============================================
// SITEMAP (auto-generated from published posts)
// ============================================
app.get('/sitemap.xml', async (req, res) => {
  try {
    const { data: posts } = await _supabase
      .from('posts')
      .select('slug, updated_at')
      .eq('status', 'published');

    const baseUrl = 'https://www.mintpixel.in';
    const urls = (posts || []).map(p => `
    <url>
      <loc>${baseUrl}/posts/${p.slug}</loc>
      <lastmod>${(p.updated_at || '').split('T')[0]}</lastmod>
      <changefreq>weekly</changefreq>
      <priority>0.8</priority>
    </url>`).join('');

    res.header('Content-Type', 'application/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}</loc>
    <priority>1.0</priority>
  </url>${urls}
</urlset>`);
  } catch (err) {
    logger.error('Sitemap generation failed:', err);
    res.status(500).send('Sitemap generation failed');
  }
});

// ============================================
// ERROR HANDLING
// ============================================
// 404 - Not Found (must be after all routes)
app.use(notFound);

// Error converter
app.use(errorConverter);

// Global error handler
app.use(errorHandler);

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

// ============================================
// START SERVER
// ============================================
const server = app.listen(PORT, '0.0.0.0', async () => {
  logger.info('='.repeat(50));
  logger.info(`✅ Server started successfully`);
  logger.info(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`📍 Port: ${PORT}`);
  logger.info(`🌐 Host: 0.0.0.0`);
  logger.info(`📚 API Docs: http://localhost:${PORT}/api-docs`);
  logger.info(`🏥 Health Check: http://localhost:${PORT}/health`);
  logger.info(`🔧 API v1: http://localhost:${PORT}/api/v1`);
  logger.info('='.repeat(50));

  // Test database connection on startup
  await testConnection();
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Close server & exit process
  server.close(() => process.exit(1));
});

module.exports = app;
