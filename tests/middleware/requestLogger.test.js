const request = require('supertest');
const express = require('express');

// Mock the logger
const mockLogger = {
  withRequestId: jest.fn(),
  http: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  security: jest.fn()
};

// Set up withRequestId to return the mockLogger
mockLogger.withRequestId.mockReturnValue(mockLogger);

jest.mock('../../src/utils/logger', () => mockLogger);

const RequestLogger = require('../../src/middleware/requestLogger');

describe('RequestLogger Middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    jest.clearAllMocks();
  });

  describe('Request Logger', () => {
    test('should log request start and completion', async () => {
      app.use((req, res, next) => {
        req.requestId = 'test-request-id';
        next();
      });
      app.use(RequestLogger.createRequestLogger());
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      await request(app)
        .get('/test')
        .expect(200);

      expect(mockLogger.withRequestId).toHaveBeenCalledWith('test-request-id');
      expect(mockLogger.http).toHaveBeenCalledWith('Request started', expect.objectContaining({
        method: 'GET',
        url: '/test',
        path: '/test'
      }));
      expect(mockLogger.info).toHaveBeenCalledWith('Request completed', expect.objectContaining({
        method: 'GET',
        url: '/test',
        statusCode: 200
      }));
    });

    test('should skip logging for configured paths', async () => {
      app.use(RequestLogger.createRequestLogger({ skipPaths: ['/health'] }));
      app.get('/health', (req, res) => {
        res.json({ status: 'OK' });
      });

      await request(app)
        .get('/health')
        .expect(200);

      expect(mockLogger.http).not.toHaveBeenCalled();
    });

    test('should log request body when enabled', async () => {
      app.use((req, res, next) => {
        req.requestId = 'test-request-id';
        next();
      });
      app.use(RequestLogger.createRequestLogger({ logBody: true }));
      app.post('/test', (req, res) => {
        res.json({ success: true });
      });

      await request(app)
        .post('/test')
        .send({ username: 'testuser', password: 'secret123' })
        .expect(200);

      expect(mockLogger.http).toHaveBeenCalledWith('Request started', expect.objectContaining({
        body: { username: 'testuser', password: '[FILTERED]' }
      }));
    });

    test('should log with different levels based on status code', async () => {
      app.use((req, res, next) => {
        req.requestId = 'test-request-id';
        next();
      });
      app.use(RequestLogger.createRequestLogger());
      
      // Test error response
      app.get('/error', (req, res) => {
        res.status(500).json({ error: 'Server error' });
      });

      await request(app)
        .get('/error')
        .expect(500);

      expect(mockLogger.error).toHaveBeenCalledWith('Request completed', expect.objectContaining({
        statusCode: 500
      }));
    });

    test('should log with warn level for client errors', async () => {
      app.use((req, res, next) => {
        req.requestId = 'test-request-id';
        next();
      });
      app.use(RequestLogger.createRequestLogger());
      
      app.get('/bad-request', (req, res) => {
        res.status(400).json({ error: 'Bad request' });
      });

      await request(app)
        .get('/bad-request')
        .expect(400);

      expect(mockLogger.warn).toHaveBeenCalledWith('Request completed', expect.objectContaining({
        statusCode: 400
      }));
    });

    test('should include user ID when available', async () => {
      app.use((req, res, next) => {
        req.requestId = 'test-request-id';
        req.user = { id: 'user-123' };
        next();
      });
      app.use(RequestLogger.createRequestLogger());
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      await request(app)
        .get('/test')
        .expect(200);

      expect(mockLogger.http).toHaveBeenCalledWith('Request started', expect.objectContaining({
        userId: 'user-123'
      }));
      expect(mockLogger.info).toHaveBeenCalledWith('Request completed', expect.objectContaining({
        userId: 'user-123'
      }));
    });
  });

  describe('Sensitive Data Filtering', () => {
    test('should filter password fields', () => {
      const data = {
        username: 'testuser',
        password: 'secret123',
        email: 'test@example.com'
      };

      const filtered = RequestLogger.filterSensitiveData(data);

      expect(filtered).toEqual({
        username: 'testuser',
        password: '[FILTERED]',
        email: 'test@example.com'
      });
    });

    test('should filter token fields', () => {
      const data = {
        authToken: 'abc123',
        refreshToken: 'def456',
        data: 'normal data'
      };

      const filtered = RequestLogger.filterSensitiveData(data);

      expect(filtered).toEqual({
        authToken: '[FILTERED]',
        refreshToken: '[FILTERED]',
        data: 'normal data'
      });
    });

    test('should handle non-object data', () => {
      expect(RequestLogger.filterSensitiveData('string')).toBe('string');
      expect(RequestLogger.filterSensitiveData(123)).toBe(123);
      expect(RequestLogger.filterSensitiveData(null)).toBe(null);
    });
  });

  describe('Error Logger', () => {
    test('should log errors with request context', async () => {
      app.use((req, res, next) => {
        req.requestId = 'test-request-id';
        req.user = { id: 'user-123' };
        next();
      });
      
      app.get('/test', (req, res, next) => {
        const error = new Error('Test error');
        error.statusCode = 400;
        error.code = 'TEST_ERROR';
        next(error);
      });
      
      app.use(RequestLogger.createErrorLogger());
      app.use((error, req, res, next) => {
        res.status(error.statusCode || 500).json({ error: error.message });
      });

      await request(app)
        .get('/test')
        .expect(400);

      expect(mockLogger.withRequestId).toHaveBeenCalledWith('test-request-id');
      expect(mockLogger.error).toHaveBeenCalledWith('Request error: Test error', expect.objectContaining({
        method: 'GET',
        url: '/test',
        statusCode: 400,
        errorCode: 'TEST_ERROR',
        userId: 'user-123'
      }));
    });
  });

  describe('Slow Request Logger', () => {
    test('should log slow requests', async () => {
      app.use((req, res, next) => {
        req.requestId = 'test-request-id';
        next();
      });
      app.use(RequestLogger.createSlowRequestLogger(100)); // 100ms threshold
      app.get('/slow', (req, res) => {
        setTimeout(() => {
          res.json({ success: true });
        }, 150); // Simulate slow response
      });

      await request(app)
        .get('/slow')
        .expect(200);

      // Wait a bit for the timeout to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(mockLogger.warn).toHaveBeenCalledWith('Slow request detected', expect.objectContaining({
        method: 'GET',
        url: '/slow',
        threshold: 100
      }));
    });
  });

  describe('Security Logger', () => {
    test('should log failed authentication attempts', async () => {
      app.use((req, res, next) => {
        req.requestId = 'test-request-id';
        next();
      });
      app.use(RequestLogger.createSecurityLogger());
      app.post('/auth/login', (req, res) => {
        res.status(401).json({ error: 'Invalid credentials' });
      });

      await request(app)
        .post('/auth/login')
        .send({ username: 'test', password: 'wrong' })
        .expect(401);

      expect(mockLogger.security).toHaveBeenCalledWith('Failed authentication attempt', expect.objectContaining({
        method: 'POST',
        url: '/auth/login'
      }));
    });
  });

  describe('Suspicious Request Detection', () => {
    test('should detect path traversal attempts', () => {
      const req = {
        originalUrl: '/api/files?path=../../../etc/passwd',
        query: {},
        body: {}
      };

      const isSuspicious = RequestLogger.isSuspiciousRequest(req);
      expect(isSuspicious).toBe(true);
    });

    test('should detect XSS attempts', () => {
      const req = {
        originalUrl: '/api/search',
        query: { q: '<script>alert("xss")</script>' },
        body: {}
      };

      const isSuspicious = RequestLogger.isSuspiciousRequest(req);
      expect(isSuspicious).toBe(true);
    });

    test('should detect SQL injection attempts', () => {
      const req = {
        originalUrl: '/api/users',
        query: {},
        body: { name: "' UNION SELECT * FROM users --" }
      };

      const isSuspicious = RequestLogger.isSuspiciousRequest(req);
      expect(isSuspicious).toBe(true);
    });

    test('should not flag normal requests', () => {
      const req = {
        originalUrl: '/api/users',
        query: { page: 1 },
        body: { name: 'John Doe', email: 'john@example.com' }
      };

      const isSuspicious = RequestLogger.isSuspiciousRequest(req);
      expect(isSuspicious).toBe(false);
    });
  });
});