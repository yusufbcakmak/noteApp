const SecurityMiddleware = require('../../src/middleware/security');
const request = require('supertest');
const express = require('express');

describe('SecurityMiddleware', () => {
  let app;

  beforeEach(() => {
    app = express();
  });

  describe('createAuthRateLimit', () => {
    it('should create rate limiting middleware for auth endpoints', () => {
      const rateLimitMiddleware = SecurityMiddleware.createAuthRateLimit();
      expect(typeof rateLimitMiddleware).toBe('function');
    });

    it('should use custom options', () => {
      const customOptions = {
        windowMs: 10 * 60 * 1000, // 10 minutes
        max: 3 // 3 attempts
      };
      
      const rateLimitMiddleware = SecurityMiddleware.createAuthRateLimit(customOptions);
      expect(typeof rateLimitMiddleware).toBe('function');
    });

    it('should skip rate limiting in test environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      app.use(SecurityMiddleware.createAuthRateLimit({ max: 1 }));
      app.get('/test', (req, res) => res.json({ success: true }));

      // Make multiple requests - should not be rate limited in test env
      await request(app).get('/test').expect(200);
      await request(app).get('/test').expect(200);
      await request(app).get('/test').expect(200);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('createGeneralRateLimit', () => {
    it('should create rate limiting middleware for general endpoints', () => {
      const rateLimitMiddleware = SecurityMiddleware.createGeneralRateLimit();
      expect(typeof rateLimitMiddleware).toBe('function');
    });

    it('should use custom options', () => {
      const customOptions = {
        windowMs: 5 * 60 * 1000, // 5 minutes
        max: 50 // 50 requests
      };
      
      const rateLimitMiddleware = SecurityMiddleware.createGeneralRateLimit(customOptions);
      expect(typeof rateLimitMiddleware).toBe('function');
    });
  });

  describe('createCorsMiddleware', () => {
    it('should create CORS middleware', () => {
      const corsMiddleware = SecurityMiddleware.createCorsMiddleware();
      expect(typeof corsMiddleware).toBe('function');
    });

    it('should allow requests in development environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      app.use(SecurityMiddleware.createCorsMiddleware());
      app.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle preflight OPTIONS requests', async () => {
      app.use(SecurityMiddleware.createCorsMiddleware());
      app.get('/test', (req, res) => res.json({ success: true }));

      await request(app)
        .options('/test')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204);
    });
  });

  describe('createHelmetMiddleware', () => {
    it('should create Helmet middleware', () => {
      const helmetMiddleware = SecurityMiddleware.createHelmetMiddleware();
      expect(typeof helmetMiddleware).toBe('function');
    });

    it('should add security headers', async () => {
      app.use(SecurityMiddleware.createHelmetMiddleware());
      app.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('0');
    });

    it('should disable CSP in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      app.use(SecurityMiddleware.createHelmetMiddleware());
      app.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.headers['content-security-policy']).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('createSizeLimitMiddleware', () => {
    it('should return size limit configuration', () => {
      const config = SecurityMiddleware.createSizeLimitMiddleware();
      
      expect(config).toHaveProperty('json');
      expect(config).toHaveProperty('urlencoded');
      expect(config.json.limit).toBe('10mb');
      expect(config.urlencoded.limit).toBe('10mb');
      expect(config.urlencoded.extended).toBe(true);
    });

    it('should allow custom size limits', () => {
      const customConfig = SecurityMiddleware.createSizeLimitMiddleware({
        json: { limit: '5mb' },
        urlencoded: { limit: '5mb', extended: false }
      });

      expect(customConfig.json.limit).toBe('5mb');
      expect(customConfig.urlencoded.limit).toBe('5mb');
      expect(customConfig.urlencoded.extended).toBe(false);
    });
  });

  describe('createSecurityHeaders', () => {
    it('should add custom security headers', async () => {
      app.use(SecurityMiddleware.createSecurityHeaders());
      app.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.headers['x-api-version']).toBe('1.0.0');
      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('should add no-cache headers for sensitive endpoints', async () => {
      app.use(SecurityMiddleware.createSecurityHeaders());
      app.get('/auth/login', (req, res) => res.json({ success: true }));
      app.get('/user/profile', (req, res) => res.json({ success: true }));
      app.get('/public', (req, res) => res.json({ success: true }));

      // Test auth endpoint
      const authResponse = await request(app)
        .get('/auth/login')
        .expect(200);

      expect(authResponse.headers['cache-control']).toBe('no-store, no-cache, must-revalidate, private');
      expect(authResponse.headers['pragma']).toBe('no-cache');
      expect(authResponse.headers['expires']).toBe('0');

      // Test user endpoint
      const userResponse = await request(app)
        .get('/user/profile')
        .expect(200);

      expect(userResponse.headers['cache-control']).toBe('no-store, no-cache, must-revalidate, private');

      // Test public endpoint (should not have no-cache headers)
      const publicResponse = await request(app)
        .get('/public')
        .expect(200);

      expect(publicResponse.headers['cache-control']).not.toBe('no-store, no-cache, must-revalidate, private');
    });
  });

  describe('createRequestIdMiddleware', () => {
    it('should add request ID to request and response', async () => {
      app.use(SecurityMiddleware.createRequestIdMiddleware());
      app.get('/test', (req, res) => {
        res.json({ requestId: req.id });
      });

      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.body.requestId).toBeDefined();
      expect(response.headers['x-request-id']).toBe(response.body.requestId);
    });

    it('should use provided request ID from headers', async () => {
      app.use(SecurityMiddleware.createRequestIdMiddleware());
      app.get('/test', (req, res) => {
        res.json({ requestId: req.id });
      });

      const customRequestId = 'custom-request-id-123';
      const response = await request(app)
        .get('/test')
        .set('X-Request-ID', customRequestId)
        .expect(200);

      expect(response.headers['x-request-id']).toBe(customRequestId);
      expect(response.body.requestId).toBe(customRequestId);
    });
  });

  describe('createSecurityStack', () => {
    it('should create array of middleware functions', () => {
      const middlewares = SecurityMiddleware.createSecurityStack();
      
      expect(Array.isArray(middlewares)).toBe(true);
      expect(middlewares.length).toBeGreaterThan(0);
      middlewares.forEach(middleware => {
        expect(typeof middleware).toBe('function');
      });
    });

    it('should allow disabling specific middleware', () => {
      const middlewares = SecurityMiddleware.createSecurityStack({
        enableRateLimit: false,
        enableCors: false,
        enableHelmet: false
      });

      expect(Array.isArray(middlewares)).toBe(true);
      expect(middlewares.length).toBe(2); // Only request ID and security headers
    });

    it('should apply all middleware in correct order', async () => {
      const middlewares = SecurityMiddleware.createSecurityStack();
      
      middlewares.forEach(middleware => {
        app.use(middleware);
      });
      
      app.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(app)
        .get('/test')
        .expect(200);

      // Check that headers from different middleware are present
      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers['x-api-version']).toBe('1.0.0');
    });

    it('should pass custom options to individual middleware', () => {
      const customOptions = {
        authRateLimitOptions: { max: 3 },
        corsOptions: { credentials: false },
        helmetOptions: { noSniff: false }
      };

      const middlewares = SecurityMiddleware.createSecurityStack(customOptions);
      
      expect(Array.isArray(middlewares)).toBe(true);
      middlewares.forEach(middleware => {
        expect(typeof middleware).toBe('function');
      });
    });
  });
});