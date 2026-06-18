# Testing Guide

## Overview
This backend uses Jest for unit and integration testing.

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode (for development)
```bash
npm run test:watch
```

### With Coverage Report
```bash
npm test -- --coverage
```

## Test Structure

```
tests/
├── setup.js              # Test configuration
├── unit/                 # Unit tests
│   ├── utils/           # Utility functions tests
│   ├── services/        # Service layer tests
│   └── middleware/      # Middleware tests
└── integration/          # API integration tests
    ├── auth.test.js     # Auth endpoint tests
    ├── chat.test.js     # Chat endpoint tests
    └── profile.test.js  # Profile endpoint tests
```

## Writing Tests

### Unit Test Example
```javascript
const ApiError = require('../../../src/utils/ApiError');

describe('ApiError', () => {
  it('should create error with status code', () => {
    const error = ApiError.badRequest('Invalid input');
    expect(error.statusCode).toBe(400);
  });
});
```

### Integration Test Example
```javascript
const request = require('supertest');
const app = require('../../src/server');

describe('POST /api/v1/auth/login', () => {
  it('should login successfully', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'password' });
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
```

## Test Database Setup

For integration tests, you'll need a test database:

1. Create `.env.test` file:
```env
SUPABASE_URL=your-test-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-test-key
JWT_SECRET=test-jwt-secret
```

2. Seed test data
3. Run tests

## Best Practices

1. **Isolation**: Each test should be independent
2. **Clean up**: Clear test data after each test
3. **Mocking**: Mock external services (OpenAI, email, etc.)
4. **Coverage**: Aim for >80% code coverage
5. **Descriptive**: Use clear test descriptions

## TODO

- [ ] Complete integration tests for all endpoints
- [ ] Add tests for chat service
- [ ] Add tests for auth service
- [ ] Set up CI/CD pipeline with automated testing
- [ ] Add E2E tests with real database
