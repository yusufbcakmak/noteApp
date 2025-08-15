const {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  InternalServerError,
  DatabaseError,
  BadRequestError,
  ServiceUnavailableError,
  TimeoutError,
  HTTP_STATUS,
  ErrorFactory
} = require('../../src/utils/errors');

describe('Error Classes', () => {
  describe('AppError', () => {
    test('should create error with all properties', () => {
      const error = new AppError('Test message', 400, 'TEST_CODE', { field: 'test' });
      
      expect(error.message).toBe('Test message');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('TEST_CODE');
      expect(error.details).toEqual({ field: 'test' });
      expect(error.isOperational).toBe(true);
      expect(error.timestamp).toBeDefined();
      expect(error.name).toBe('AppError');
    });

    test('should generate default code from class name', () => {
      const error = new AppError('Test message', 400);
      expect(error.code).toBe('APPERROR');
    });

    test('should serialize to JSON correctly', () => {
      const error = new AppError('Test message', 400, 'TEST_CODE', { field: 'test' });
      const json = error.toJSON();
      
      expect(json).toMatchObject({
        success: false,
        error: {
          code: 'TEST_CODE',
          message: 'Test message',
          details: { field: 'test' }
        },
        timestamp: expect.any(String)
      });
    });

    test('should set and include request ID', () => {
      const error = new AppError('Test message', 400);
      error.setRequestId('test-request-id');
      
      const json = error.toJSON();
      expect(json.requestId).toBe('test-request-id');
    });

    test('should capture stack trace', () => {
      const error = new AppError('Test message', 400);
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AppError');
    });
  });

  describe('ValidationError', () => {
    test('should create validation error with correct properties', () => {
      const error = new ValidationError('Validation failed', { fields: ['email'] });
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Validation failed');
      expect(error.details).toEqual({ fields: ['email'] });
    });

    test('should work without details', () => {
      const error = new ValidationError('Validation failed');
      expect(error.details).toBeNull();
    });
  });

  describe('AuthenticationError', () => {
    test('should create authentication error with default message', () => {
      const error = new AuthenticationError();
      
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTHENTICATION_ERROR');
      expect(error.message).toBe('Authentication failed');
    });

    test('should accept custom message and details', () => {
      const error = new AuthenticationError('Invalid credentials', { attempts: 3 });
      
      expect(error.message).toBe('Invalid credentials');
      expect(error.details).toEqual({ attempts: 3 });
    });
  });

  describe('AuthorizationError', () => {
    test('should create authorization error with default message', () => {
      const error = new AuthorizationError();
      
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('AUTHORIZATION_ERROR');
      expect(error.message).toBe('Access denied');
    });
  });

  describe('NotFoundError', () => {
    test('should create not found error with default message', () => {
      const error = new NotFoundError();
      
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('Resource not found');
    });
  });

  describe('ConflictError', () => {
    test('should create conflict error with default message', () => {
      const error = new ConflictError();
      
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT_ERROR');
      expect(error.message).toBe('Resource conflict');
    });
  });

  describe('RateLimitError', () => {
    test('should create rate limit error with default message', () => {
      const error = new RateLimitError();
      
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_ERROR');
      expect(error.message).toBe('Too many requests');
    });
  });

  describe('InternalServerError', () => {
    test('should create internal server error with default message', () => {
      const error = new InternalServerError();
      
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(error.message).toBe('Internal server error');
    });
  });

  describe('DatabaseError', () => {
    test('should create database error with default message', () => {
      const error = new DatabaseError();
      
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.message).toBe('Database operation failed');
    });
  });

  describe('BadRequestError', () => {
    test('should create bad request error with default message', () => {
      const error = new BadRequestError();
      
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.message).toBe('Bad request');
    });
  });

  describe('ServiceUnavailableError', () => {
    test('should create service unavailable error with default message', () => {
      const error = new ServiceUnavailableError();
      
      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
      expect(error.message).toBe('Service temporarily unavailable');
    });
  });

  describe('TimeoutError', () => {
    test('should create timeout error with default message', () => {
      const error = new TimeoutError();
      
      expect(error.statusCode).toBe(408);
      expect(error.code).toBe('TIMEOUT_ERROR');
      expect(error.message).toBe('Request timeout');
    });
  });
});

describe('HTTP_STATUS constants', () => {
  test('should have correct status codes', () => {
    expect(HTTP_STATUS.OK).toBe(200);
    expect(HTTP_STATUS.CREATED).toBe(201);
    expect(HTTP_STATUS.NO_CONTENT).toBe(204);
    expect(HTTP_STATUS.BAD_REQUEST).toBe(400);
    expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
    expect(HTTP_STATUS.FORBIDDEN).toBe(403);
    expect(HTTP_STATUS.NOT_FOUND).toBe(404);
    expect(HTTP_STATUS.CONFLICT).toBe(409);
    expect(HTTP_STATUS.UNPROCESSABLE_ENTITY).toBe(422);
    expect(HTTP_STATUS.TOO_MANY_REQUESTS).toBe(429);
    expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBe(500);
    expect(HTTP_STATUS.SERVICE_UNAVAILABLE).toBe(503);
  });
});

describe('ErrorFactory', () => {
  test('should create validation error', () => {
    const error = ErrorFactory.validation('Invalid input', { field: 'email' });
    
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toBe('Invalid input');
    expect(error.details).toEqual({ field: 'email' });
  });

  test('should create authentication error', () => {
    const error = ErrorFactory.authentication('Login failed', { attempts: 3 });
    
    expect(error).toBeInstanceOf(AuthenticationError);
    expect(error.message).toBe('Login failed');
    expect(error.details).toEqual({ attempts: 3 });
  });

  test('should create authentication error with default message', () => {
    const error = ErrorFactory.authentication();
    expect(error.message).toBe('Authentication failed');
  });

  test('should create authorization error', () => {
    const error = ErrorFactory.authorization('Access denied', { role: 'user' });
    
    expect(error).toBeInstanceOf(AuthorizationError);
    expect(error.message).toBe('Access denied');
    expect(error.details).toEqual({ role: 'user' });
  });

  test('should create not found error with resource name', () => {
    const error = ErrorFactory.notFound('User', { id: '123' });
    
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.message).toBe('User not found');
    expect(error.details).toEqual({ id: '123' });
  });

  test('should create conflict error', () => {
    const error = ErrorFactory.conflict('Email already exists', { email: 'test@example.com' });
    
    expect(error).toBeInstanceOf(ConflictError);
    expect(error.message).toBe('Email already exists');
    expect(error.details).toEqual({ email: 'test@example.com' });
  });

  test('should create rate limit error', () => {
    const error = ErrorFactory.rateLimit('Too many login attempts', { limit: 5 });
    
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.message).toBe('Too many login attempts');
    expect(error.details).toEqual({ limit: 5 });
  });

  test('should create internal server error', () => {
    const error = ErrorFactory.internal('Database connection failed', { code: 'ECONNREFUSED' });
    
    expect(error).toBeInstanceOf(InternalServerError);
    expect(error.message).toBe('Database connection failed');
    expect(error.details).toEqual({ code: 'ECONNREFUSED' });
  });

  test('should create database error', () => {
    const error = ErrorFactory.database('Query failed', { query: 'SELECT * FROM users' });
    
    expect(error).toBeInstanceOf(DatabaseError);
    expect(error.message).toBe('Query failed');
    expect(error.details).toEqual({ query: 'SELECT * FROM users' });
  });

  test('should create bad request error', () => {
    const error = ErrorFactory.badRequest('Invalid JSON', { position: 10 });
    
    expect(error).toBeInstanceOf(BadRequestError);
    expect(error.message).toBe('Invalid JSON');
    expect(error.details).toEqual({ position: 10 });
  });
});