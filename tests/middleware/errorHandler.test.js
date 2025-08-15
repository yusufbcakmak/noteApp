const request = require('supertest');
const express = require('express');
const ErrorHandler = require('../../src/middleware/errorHandler');
const { 
  AppError, 
  ValidationError, 
  AuthenticationError,
  NotFoundError,
  DatabaseError,
  ErrorFactory
} = require('../../src/utils/errors');

describe('ErrorHandler Middleware', () => {
  let app;

  const createTestApp = () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use(ErrorHandler.createRequestIdMiddleware());
    return testApp;
  };

  describe('Global Error Handler', () => {
    test('should handle AppError instances correctly', async () => {
      app = createTestApp();
      app.get('/test-app-error', (req, res, next) => {
        const error = new ValidationError('Test validation error', { field: 'email' });
        next(error);
      });
      app.use(ErrorHandler.createGlobalErrorHandler());

      const response = await request(app)
        .get('/test-app-error')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Test validation error',
          details: { field: 'email' }
        },
        timestamp: expect.any(String),
        requestId: expect.any(String)
      });
    });

    test('should handle JWT errors', async () => {
      app = createTestApp();
      app.get('/test-jwt-error', (req, res, next) => {
        const error = new Error('invalid signature');
        error.name = 'JsonWebTokenError';
        next(error);
      });
      app.use(ErrorHandler.createGlobalErrorHandler());

      const response = await request(app)
        .get('/test-jwt-error')
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
      expect(response.body.error.message).toBe('Invalid token');
    });

    test('should handle token expired errors', async () => {
      app = createTestApp();
      app.get('/test-token-expired', (req, res, next) => {
        const error = new Error('jwt expired');
        error.name = 'TokenExpiredError';
        next(error);
      });
      app.use(ErrorHandler.createGlobalErrorHandler());

      const response = await request(app)
        .get('/test-token-expired')
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
      expect(response.body.error.message).toBe('Token expired');
    });

    test('should handle SQLite constraint errors', async () => {
      app = createTestApp();
      app.get('/test-sqlite-constraint', (req, res, next) => {
        const error = new Error('UNIQUE constraint failed: users.email');
        error.code = 'SQLITE_CONSTRAINT_UNIQUE';
        next(error);
      });
      app.use(ErrorHandler.createGlobalErrorHandler());

      const response = await request(app)
        .get('/test-sqlite-constraint')
        .expect(409);

      expect(response.body.error.code).toBe('CONFLICT_ERROR');
      expect(response.body.error.message).toBe('Resource already exists');
    });

    test('should handle SQLite database errors', async () => {
      app = createTestApp();
      app.get('/test-sqlite-error', (req, res, next) => {
        const error = new Error('database is locked');
        error.code = 'SQLITE_BUSY';
        next(error);
      });
      app.use(ErrorHandler.createGlobalErrorHandler());

      const response = await request(app)
        .get('/test-sqlite-error')
        .expect(500);

      expect(response.body.error.code).toBe('DATABASE_ERROR');
      expect(response.body.error.message).toBe('Database operation failed');
    });

    test('should handle JSON syntax errors', async () => {
      app = createTestApp();
      app.post('/test-json-error', (req, res, next) => {
        const error = new SyntaxError('Unexpected token } in JSON at position 1');
        error.message = 'Unexpected token } in JSON at position 1';
        next(error);
      });
      app.use(ErrorHandler.createGlobalErrorHandler());

      const response = await request(app)
        .post('/test-json-error')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Invalid JSON in request body');
    });

    test('should handle payload too large errors', async () => {
      app = createTestApp();
      app.post('/test-payload-error', (req, res, next) => {
        const error = new Error('request entity too large');
        error.type = 'entity.too.large';
        error.limit = 1048576;
        error.length = 2097152;
        next(error);
      });
      app.use(ErrorHandler.createGlobalErrorHandler());

      const response = await request(app)
        .post('/test-payload-error')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Request payload too large');
      expect(response.body.error.details).toMatchObject({
        limit: 1048576,
        length: 2097152
      });
    });

    test('should handle unknown errors as internal server errors', async () => {
      app = createTestApp();
      app.get('/test-unknown-error', (req, res, next) => {
        const error = new Error('Something went wrong');
        next(error);
      });
      app.use(ErrorHandler.createGlobalErrorHandler());

      const response = await request(app)
        .get('/test-unknown-error')
        .expect(500);

      expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
      
      // In development, should show actual error message
      if (process.env.NODE_ENV !== 'production') {
        expect(response.body.error.message).toBe('Something went wrong');
      }
    });

    test('should include request ID in error responses', async () => {
      app = createTestApp();
      app.get('/test-request-id', (req, res, next) => {
        next(new ValidationError('Test error'));
      });
      app.use(ErrorHandler.createGlobalErrorHandler());

      const response = await request(app)
        .get('/test-request-id')
        .expect(400);

      expect(response.body.requestId).toBeDefined();
      expect(typeof response.body.requestId).toBe('string');
      expect(response.headers['x-request-id']).toBeDefined();
    });
  });

  describe('Request ID Middleware', () => {
    test('should add request ID to request and response headers', async () => {
      app = createTestApp();
      app.get('/test-request-id', (req, res) => {
        expect(req.requestId).toBeDefined();
        res.json({ requestId: req.requestId });
      });

      const response = await request(app)
        .get('/test-request-id')
        .expect(200);

      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.body.requestId).toBe(response.headers['x-request-id']);
    });
  });

  describe('Async Handler', () => {
    test('should catch async errors and pass to error handler', async () => {
      app = createTestApp();
      app.get('/test-async-error', ErrorHandler.asyncHandler(async (req, res, next) => {
        await new Promise((resolve, reject) => {
          setTimeout(() => reject(new ValidationError('Async error')), 10);
        });
      }));
      app.use(ErrorHandler.createGlobalErrorHandler());

      const response = await request(app)
        .get('/test-async-error')
        .expect(400);

      expect(response.body.error.message).toBe('Async error');
    });

    test('should handle successful async operations', async () => {
      app = createTestApp();
      app.get('/test-async-success', ErrorHandler.asyncHandler(async (req, res) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        res.json({ success: true });
      }));

      const response = await request(app)
        .get('/test-async-success')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Not Found Handler', () => {
    test('should handle 404 errors', async () => {
      app = createTestApp();
      app.use(ErrorHandler.createNotFoundHandler());
      app.use(ErrorHandler.createGlobalErrorHandler());

      const response = await request(app)
        .get('/non-existent-route')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Route GET /non-existent-route not found'
        }
      });
    });
  });

  describe('Validation Error Handler', () => {
    test('should handle Joi validation errors', async () => {
      app = createTestApp();
      
      app.post('/test-joi-error', (req, res, next) => {
        const error = new Error('Validation failed');
        error.isJoi = true;
        error.details = [
          {
            path: ['email'],
            message: '"email" must be a valid email',
            context: { value: 'invalid-email' }
          },
          {
            path: ['password'],
            message: '"password" length must be at least 8 characters long',
            context: { value: '123' }
          }
        ];
        next(error);
      });
      
      app.use(ErrorHandler.handleValidationError);
      app.use(ErrorHandler.createGlobalErrorHandler());

      const response = await request(app)
        .post('/test-joi-error')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Validation failed');
      expect(response.body.error.details.fields).toHaveLength(2);
      expect(response.body.error.details.fields[0]).toMatchObject({
        field: 'email',
        message: '"email" must be a valid email',
        value: 'invalid-email'
      });
    });

    test('should pass non-Joi errors to next middleware', async () => {
      app = createTestApp();
      let errorPassed = false;
      
      app.get('/test-non-joi-error', (req, res, next) => {
        const error = new Error('Not a Joi error');
        next(error);
      });

      app.use(ErrorHandler.handleValidationError);
      app.use((error, req, res, next) => {
        errorPassed = true;
        res.status(500).json({ error: 'Handled by next middleware' });
      });

      await request(app)
        .get('/test-non-joi-error')
        .expect(500);

      expect(errorPassed).toBe(true);
    });
  });
});

describe('Error Factory', () => {
  test('should create validation errors', () => {
    const error = ErrorFactory.validation('Invalid input', { field: 'email' });
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toBe('Invalid input');
    expect(error.details).toEqual({ field: 'email' });
  });

  test('should create authentication errors', () => {
    const error = ErrorFactory.authentication('Login failed');
    expect(error).toBeInstanceOf(AuthenticationError);
    expect(error.message).toBe('Login failed');
  });

  test('should create not found errors with resource name', () => {
    const error = ErrorFactory.notFound('User');
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.message).toBe('User not found');
  });

  test('should create database errors', () => {
    const error = ErrorFactory.database('Connection failed');
    expect(error).toBeInstanceOf(DatabaseError);
    expect(error.message).toBe('Connection failed');
  });
});