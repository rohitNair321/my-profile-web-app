// config/swagger.js
const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Portfolio Backend API',
      version: '2.0.0',
      description: 'Complete API Documentation for Developer Portfolio System with AI Chat',
      contact: {
        name: 'Developer Support',
        email: process.env.CONTACT_EMAIL || 'support@example.com',
      },
      license: {
        name: 'MIT',
      },
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:3000',
        description: 'API Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'token',
          description: 'Session cookie with JWT token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            statusCode: {
              type: 'integer',
              example: 400,
            },
            message: {
              type: 'string',
              example: 'Error message',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            statusCode: {
              type: 'integer',
              example: 200,
            },
            data: {
              type: 'object',
            },
            message: {
              type: 'string',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Auth',
        description: 'Authentication endpoints',
      },
      {
        name: 'Chat',
        description: 'AI Chat functionality',
      },
      {
        name: 'Profile',
        description: 'Portfolio profile management',
      },
      {
        name: 'Contact',
        description: 'Contact form endpoints',
      },
      {
        name: 'Health',
        description: 'Health check endpoints',
      },
    ],
  },
  apis: [
    path.join(__dirname, '../api/v1/**/*.routes.js'),
    path.join(__dirname, '../routes/**/*.js'),
  ],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);

module.exports = swaggerDocs;
