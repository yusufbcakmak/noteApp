const request = require('supertest');
const app = require('../../src/app');

describe('Validation Integration Tests', () => {
  describe('Input Validation', () => {
    it('should validate registration input and return detailed errors', async () => {
      const invalidData = {
        email: 'invalid-email',
        password: '123', // too short
        firstName: '', // empty
        lastName: '' // empty
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Request validation failed');
      expect(Array.isArray(response.body.error.details)).toBe(true);
      expect(response.body.error.details.length).toBeGreaterThan(0);
    });

    it('should sanitize HTML input in registration', async () => {
      const timestamp = Date.now();
      const maliciousData = {
        email: `test-sanitize-${timestamp}@example.com`,
        password: 'Password123',
        firstName: '<script>alert("xss")</script>John',
        lastName: 'Doe<img src=x onerror=alert(1)>'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(maliciousData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.firstName).not.toContain('<script>');
      expect(response.body.data.user.firstName).toContain('&quot;'); // Should be escaped
      expect(response.body.data.user.lastName).not.toContain('<img');
      expect(response.body.data.user.lastName).not.toContain('onerror');
    });

    it('should validate query parameters for notes endpoint', async () => {
      // First register and login to get a token
      const timestamp = Date.now();
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: `test-query-${timestamp}@example.com`,
          password: 'Password123',
          firstName: 'John',
          lastName: 'Doe'
        })
        .expect(201);

      const token = registerResponse.body.data.tokens.accessToken;

      // Test invalid query parameters
      const response = await request(app)
        .get('/api/notes?page=0&limit=200&status=invalid_status')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Query validation failed');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers['x-api-version']).toBe('1.0.0');
    });

    it('should add no-cache headers for auth endpoints', async () => {
      const response = await request(app)
        .get('/api/auth/health')
        .expect(200);

      expect(response.headers['cache-control']).toBe('no-store, no-cache, must-revalidate, private');
      expect(response.headers['pragma']).toBe('no-cache');
      expect(response.headers['expires']).toBe('0');
    });

    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/auth/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should skip rate limiting in test environment', async () => {
      // Make multiple requests to auth endpoint - should not be rate limited in test
      const requests = Array(10).fill().map(() => 
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'wrongpassword'
          })
      );

      const responses = await Promise.all(requests);
      
      // All should return 401 (invalid credentials) not 429 (rate limited)
      responses.forEach(response => {
        expect(response.status).toBe(401);
        expect(response.body.error.code).not.toBe('RATE_LIMIT_EXCEEDED');
      });
    });
  });

  describe('Request Size Limits', () => {
    it('should accept requests within size limits', async () => {
      const timestamp = Date.now();
      const normalSizeData = {
        email: `test-size-${timestamp}@example.com`,
        password: 'Password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(normalSizeData)
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });
});