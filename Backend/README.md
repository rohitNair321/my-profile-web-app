# Portfolio Backend API - v2.0

## 🎯 Overview

Production-ready backend API for portfolio website with AI-powered chat, admin authentication, and comprehensive error handling.

## ✨ Features

- ✅ **RESTful API** with versioning (`/api/v1/`)
- ✅ **AI Chatbot** powered by OpenAI (o4-mini model)
- ✅ **Guest & Admin Access** with proper session management
- ✅ **JWT Authentication** with httpOnly cookies
- ✅ **Rate Limiting** (API, Auth, Chat-specific)
- ✅ **Comprehensive Logging** with Winston
- ✅ **Input Validation** with Joi
- ✅ **Error Handling** centralized & standardized
- ✅ **API Documentation** with Swagger/OpenAPI
- ✅ **Security** (Helmet, XSS sanitization, CORS)
- ✅ **Supabase PostgreSQL** database
- ✅ **Testing Infrastructure** (Jest)

## 📁 Project Structure

```
backend/
├── src/
│   ├── api/v1/              # API version 1
│   │   ├── auth/           # Auth endpoints
│   │   ├── chat/           # Chat endpoints
│   │   ├── profile/        # Profile endpoints
│   │   ├── contact/        # Contact endpoints
│   │   └── index.js        # Route aggregator
│   ├── config/             # Configuration
│   │   ├── logger.js       # Winston logger
│   │   ├── database.js     # Supabase client
│   │   ├── constants.js    # App constants
│   │   └── swagger.js      # API documentation
│   ├── middleware/         # Custom middleware
│   │   ├── authMiddleware.js     # Auth & guest handling
│   │   ├── errorHandler.js       # Error handling
│   │   ├── requestLogger.js      # Request logging
│   │   └── rateLimiter.js        # Rate limiting
│   ├── services/           # Business logic
│   │   ├── authService.js  # Authentication
│   │   ├── chatService.js  # Chat & AI
│   │   └── aiService.js    # OpenAI integration
│   ├── utils/              # Utilities
│   │   ├── ApiResponse.js  # Standard responses
│   │   ├── ApiError.js     # Custom errors
│   │   ├── catchAsync.js   # Async wrapper
│   │   └── validators.js   # Joi validators
│   ├── controllers/        # (Legacy - kept for compatibility)
│   ├── routes/             # (Legacy - kept for compatibility)
│   └── server.js           # Express app
├── tests/                  # Tests
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── setup.js           # Test config
├── logs/                   # Log files
├── .env.example           # Environment template
├── package.json
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js v18+ (LTS)
- npm or yarn
- Supabase account
- OpenAI API key

### Installation

1. **Clone & Install**
```bash
cd backend
npm install
```

2. **Environment Setup**
```bash
cp .env.example .env
# Edit .env with your credentials
```

3. **Required Environment Variables**
```env
NODE_ENV=development
PORT=3000
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-key
JWT_SECRET=your-secret
OPENAI_API_KEY=your-openai-key
PROFILE_OWNER_ID=your-user-uuid
```

### Running

```bash
# Development with auto-reload
npm run dev

# Production
npm start

# Testing
npm test
```

## 📚 API Documentation

Once running, visit: **http://localhost:3000/api-docs**

### Base URLs

- **Development**: `http://localhost:3000`
- **Production**: Your deployed URL

### Endpoints

#### Authentication (`/api/v1/auth`)
- `POST /login` - Admin login
- `POST /logout` - Logout
- `POST /forgot-password` - Request reset
- `POST /reset-password` - Reset password
- `PUT /update-password` - Change password
- `GET /init` - Initialize app

#### Chat (`/api/v1/chat`)
- `POST /send` - Send message to AI
- `GET /sessions` - Get chat sessions
- `GET /sessions/:id` - Get single session
- `DELETE /sessions/:id` - Delete session
- `DELETE /sessions` - Delete all (admin)
- `GET /stats` - Chat statistics (admin)

#### Profile (`/api/v1/profile`)
- `GET /` - Get profile
- `PUT /` - Update profile (admin)

#### Contact (`/api/v1/contact`)
- `POST /` - Submit contact form

### Authentication

**Two methods:**

1. **Cookie (Recommended)**
   - Set automatically on login
   - httpOnly, secure, sameSite

2. **Bearer Token**
   ```
   Authorization: Bearer <token>
   ```

## 🔒 Security Features

- **Helmet.js**: Security headers
- **CORS**: Configured origins only
- **XSS Protection**: Input sanitization
- **Rate Limiting**: Per endpoint
- **JWT**: Secure token-based auth
- **httpOnly Cookies**: XSS protection
- **Input Validation**: Joi schemas
- **SQL Injection**: Parameterized queries

## 🤖 AI Chat Features

### Guest Users
- ✅ Unique session ID via cookie
- ✅ 5 questions per 24 hours
- ✅ Own chat history only
- ✅ Automatic rate limiting

### Admin Users
- ✅ Unlimited questions
- ✅ Access to ALL chat sessions
- ✅ Chat statistics
- ✅ Delete sessions

### Guest Session Management
```javascript
// Guest ID stored in cookie
Cookie: guestId=<uuid>

// Linked to chat_sessions table
{
  id: uuid,
  guest_id: uuid,
  messages: [...],
  role: 'guest',
  is_guest: true
}
```

## 📊 Logging

Logs are stored in `/logs/`:
- `combined.log` - All logs
- `error.log` - Errors only

**Log Levels**: error, warn, info, debug

**Format**:
```
2025-03-30 10:30:45 [info]: User logged in { userId: '123', role: 'admin' }
```

## 🧪 Testing

### Run Tests
```bash
npm test                # All tests
npm run test:watch      # Watch mode
npm test -- --coverage  # With coverage
```

### Test Structure
- **Unit Tests**: `tests/unit/`
- **Integration Tests**: `tests/integration/`

See `tests/TESTING_GUIDE.md` for details.

## 📦 Deployment

### Render (Current)
```yaml
Build Command: npm install
Start Command: npm start
Environment: Node.js 18
```

### Environment Variables (Production)
Ensure all required vars are set on Render:
- NODE_ENV=production
- All database credentials
- API keys
- CORS origins

## 🔄 Migration from v1

**Backward Compatible**: Old routes still work

- `/api/auth/*` → Still functional
- `/api/chat/*` → Still functional
- `/api/profile/*` → Still functional

**New routes** (recommended):
- `/api/v1/auth/*`
- `/api/v1/chat/*`
- `/api/v1/profile/*`

**Changes**:
1. ✅ Guest sessions now use `guestId` cookie (not IP)
2. ✅ Standardized error responses
3. ✅ Enhanced validation
4. ✅ Better logging
5. ✅ Comprehensive documentation

## 🛠️ Development

### Adding New Endpoint

1. **Create Controller**
```javascript
// api/v1/feature/feature.controller.js
const catchAsync = require('../../../utils/catchAsync');
const ApiResponse = require('../../../utils/ApiResponse');

const getFeature = catchAsync(async (req, res) => {
  const data = await featureService.get();
  const response = ApiResponse.success(data);
  res.status(response.statusCode).json(response);
});
```

2. **Create Route**
```javascript
// api/v1/feature/feature.routes.js
const router = require('express').Router();
const controller = require('./feature.controller');

router.get('/', controller.getFeature);
module.exports = router;
```

3. **Mount in v1**
```javascript
// api/v1/index.js
const featureRoutes = require('./feature/feature.routes');
router.use('/feature', featureRoutes);
```

## 📝 Code Standards

- **ES6+** syntax
- **Async/await** for promises
- **Try/catch** handled by `catchAsync`
- **camelCase** for variables
- **PascalCase** for classes
- **Comments** for complex logic
- **Validation** for all inputs

## 🐛 Troubleshooting

### Server won't start
```bash
# Check logs
tail -f logs/error.log

# Verify environment
node -v  # Should be 18+
npm list

# Check database connection
curl http://localhost:3000/api/health/db
```

### Database issues
```bash
# Test Supabase connection
# Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
```

### Chat not working
```bash
# Verify OpenAI API key
# Check guest cookie is set
# Check rate limit not exceeded
```

## 📞 Support

- **Documentation**: `/api-docs`
- **Logs**: `/logs/`
- **Health Check**: `/health`
- **DB Health**: `/api/health/db`

## 📄 License

MIT

---

**Version**: 2.0.0  
**Last Updated**: March 2026  
**Maintainer**: Rohit Nair
