/**
 * API consistency validation tests
 */

const fs = require('fs').promises;
const path = require('path');
const ApiConsistencyValidator = require('../../src/utils/apiConsistencyValidator');
const MockServer = require('../../src/utils/mockServer');
const SchemaValidation = require('../../src/middleware/schemaValidation');

describe('API Consistency Validation', () => {
  let validator;
  let mockServer;
  let schemaValidation;

  beforeAll(async () => {
    validator = new ApiConsistencyValidator();
    await validator.init();

    mockServer = new MockServer({ port: 3002 });
    await mockServer.init();

    schemaValidation = new SchemaValidation();
    await schemaValidation.init();
  });

  afterAll(async () => {
    if (mockServer.server) {
      await mockServer.stop();
    }
  });

  describe('Frontend API Call Scanning', () => {
    test('should extract API calls from JavaScript code', () => {
      const code = `
        // Fetch calls
        fetch('/api/notes', { method: 'GET' });
        fetch('/api/notes', { method: 'POST', body: JSON.stringify(data) });
        
        // Axios calls
        axios.get('/api/groups');
        axios.post('/api/groups', data);
        
        // API client calls
        api.get('/api/history');
        client.delete('/api/notes/123');
      `;

      const apiCalls = validator.extractApiCalls(code, 'test.js');
      
      expect(apiCalls).toHaveLength(6);
      expect(apiCalls).toContainEqual({
        method: 'GET',
        path: '/api/notes',
        file: 'test.js',
        line: 3
      });
      expect(apiCalls).toContainEqual({
        method: 'POST',
        path: '/api/notes',
        file: 'test.js',
        line: 4
      });
      expect(apiCalls).toContainEqual({
        method: 'GET',
        path: '/api/groups',
        file: 'test.js',
        line: 7
      });
    });

    test('should ignore non-API calls', () => {
      const code = `
        fetch('/some/other/path');
        axios.get('/not-api/endpoint');
        api.post('/external/service');
      `;

      const apiCalls = validator.extractApiCalls(code, 'test.js');
      expect(apiCalls).toHaveLength(0);
    });

    test('should handle TypeScript code', () => {
      const code = `
        interface ApiResponse<T> {
          data: T;
        }
        
        const response: ApiResponse<Note[]> = await fetch('/api/notes');
        axios.post<User>('/api/auth/login', credentials);
      `;

      const apiCalls = validator.extractApiCalls(code, 'test.ts');
      expect(apiCalls).toHaveLength(2);
      expect(apiCalls[0].path).toBe('/api/notes');
      expect(apiCalls[1].path).toBe('/api/auth/login');
    });
  });

  describe('Backend Endpoint Extraction', () => {
    test('should extract endpoints from OpenAPI spec', async () => {
      expect(validator.backendEndpoints.size).toBeGreaterThan(0);
      
      // Check for specific endpoints
      expect(validator.backendEndpoints.has('GET /api/notes')).toBe(true);
      expect(validator.backendEndpoints.has('POST /api/notes')).toBe(true);
      expect(validator.backendEndpoints.has('POST /api/auth/login')).toBe(true);
      
      const notesEndpoint = validator.backendEndpoints.get('GET /api/notes');
      expect(notesEndpoint).toBeDefined();
      expect(notesEndpoint.method).toBe('GET');
      expect(notesEndpoint.path).toBe('/api/notes');
      expect(notesEndpoint.parameters).toBeDefined();
    });

    test('should handle parameterized paths', () => {
      expect(validator.backendEndpoints.has('GET /api/notes/{id}')).toBe(true);
      expect(validator.backendEndpoints.has('PUT /api/notes/{id}')).toBe(true);
      expect(validator.backendEndpoints.has('DELETE /api/notes/{id}')).toBe(true);
    });
  });

  describe('Path Matching', () => {
    test('should match exact paths', () => {
      expect(validator.pathsMatch('/api/notes', '/api/notes')).toBe(true);
      expect(validator.pathsMatch('/api/groups', '/api/groups')).toBe(true);
      expect(validator.pathsMatch('/api/notes', '/api/groups')).toBe(false);
    });

    test('should match parameterized paths', () => {
      expect(validator.pathsMatch('/api/notes/123', '/api/notes/{id}')).toBe(true);
      expect(validator.pathsMatch('/api/notes/abc', '/api/notes/{id}')).toBe(true);
      expect(validator.pathsMatch('/api/groups/456/notes', '/api/groups/{id}/notes')).toBe(true);
      expect(validator.pathsMatch('/api/notes', '/api/notes/{id}')).toBe(false);
    });

    test('should handle complex parameterized paths', () => {
      expect(validator.pathsMatch('/api/users/123/notes/456', '/api/users/{userId}/notes/{noteId}')).toBe(true);
      expect(validator.pathsMatch('/api/users/123/notes', '/api/users/{userId}/notes/{noteId}')).toBe(false);
    });
  });

  describe('Similarity Calculation', () => {
    test('should calculate path similarity correctly', () => {
      expect(validator.calculatePathSimilarity('/api/notes', '/api/notes')).toBe(1);
      expect(validator.calculatePathSimilarity('/api/notes', '/api/groups')).toBeLessThan(1);
      expect(validator.calculatePathSimilarity('/api/notes', '/api/note')).toBeGreaterThan(0.8);
      expect(validator.calculatePathSimilarity('/api/notes', '/completely/different')).toBeLessThan(0.5);
    });

    test('should handle empty strings', () => {
      expect(validator.calculatePathSimilarity('', '')).toBe(1);
      expect(validator.calculatePathSimilarity('test', '')).toBeLessThan(1);
      expect(validator.calculatePathSimilarity('', 'test')).toBeLessThan(1);
    });
  });

  describe('Consistency Validation', () => {
    beforeEach(() => {
      // Clear previous data
      validator.frontendApiCalls.clear();
      validator.inconsistencies = [];
    });

    test('should detect missing backend endpoints', async () => {
      // Add frontend calls that don\'t exist in backend
      validator.frontendApiCalls.set('GET /api/nonexistent', [{
        method: 'GET',
        path: '/api/nonexistent',
        file: 'test.js',
        line: 1
      }]);

      const inconsistencies = await validator.validateConsistency();
      
      const missingEndpoints = inconsistencies.filter(i => i.type === 'missing_backend_endpoint');
      expect(missingEndpoints.length).toBeGreaterThan(0);
      expect(missingEndpoints[0].severity).toBe('error');
    });

    test('should detect unused backend endpoints', async () => {
      // Don\'t add any frontend calls, so all backend endpoints appear unused
      const inconsistencies = await validator.validateConsistency();
      
      const unusedEndpoints = inconsistencies.filter(i => i.type === 'unused_backend_endpoint');
      expect(unusedEndpoints.length).toBeGreaterThan(0);
      
      // Should not flag internal endpoints as unused
      const internalEndpoints = unusedEndpoints.filter(i => 
        i.endpoint.path.includes('/health') || 
        i.endpoint.path.includes('/api-docs') ||
        i.endpoint.path.includes('/openapi.json')
      );
      expect(internalEndpoints.length).toBe(0);
    });

    test('should not flag matching endpoints as inconsistent', async () => {
      // Add frontend calls that match backend endpoints
      validator.frontendApiCalls.set('GET /api/notes', [{
        method: 'GET',
        path: '/api/notes',
        file: 'test.js',
        line: 1
      }]);
      
      validator.frontendApiCalls.set('POST /api/notes', [{
        method: 'POST',
        path: '/api/notes',
        file: 'test.js',
        line: 2
      }]);

      const inconsistencies = await validator.validateConsistency();
      
      // Should not have errors for these matching endpoints
      const missingEndpoints = inconsistencies.filter(i => 
        i.type === 'missing_backend_endpoint' && 
        (i.message.includes('GET /api/notes') || i.message.includes('POST /api/notes'))
      );
      expect(missingEndpoints.length).toBe(0);
    });

    test('should handle parameterized paths correctly', async () => {
      // Add frontend call with actual ID
      validator.frontendApiCalls.set('GET /api/notes/123', [{
        method: 'GET',
        path: '/api/notes/123',
        file: 'test.js',
        line: 1
      }]);

      const inconsistencies = await validator.validateConsistency();
      
      // Should not flag this as missing since it matches /api/notes/{id}
      const missingEndpoints = inconsistencies.filter(i => 
        i.type === 'missing_backend_endpoint' && 
        i.message.includes('GET /api/notes/123')
      );
      expect(missingEndpoints.length).toBe(0);
    });
  });

  describe('Report Generation', () => {
    test('should generate comprehensive report', async () => {
      // Add some test data
      validator.frontendApiCalls.set('GET /api/notes', [{
        method: 'GET',
        path: '/api/notes',
        file: 'test.js',
        line: 1
      }]);

      await validator.validateConsistency();
      const report = validator.generateReport();

      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('inconsistencies');
      expect(report).toHaveProperty('frontendApiCalls');
      expect(report).toHaveProperty('backendEndpoints');

      expect(report.summary).toHaveProperty('totalFrontendCalls');
      expect(report.summary).toHaveProperty('totalBackendEndpoints');
      expect(report.summary).toHaveProperty('totalInconsistencies');
      expect(report.summary).toHaveProperty('errorCount');
      expect(report.summary).toHaveProperty('warningCount');
    });

    test('should generate human-readable report', async () => {
      await validator.validateConsistency();
      const humanReport = validator.generateHumanReadableReport();

      expect(typeof humanReport).toBe('string');
      expect(humanReport).toContain('# API Consistency Report');
      expect(humanReport).toContain('## Summary');
      expect(humanReport).toContain('Frontend API calls:');
      expect(humanReport).toContain('Backend endpoints:');
    });
  });

  describe('Mock Server', () => {
    test('should start and stop mock server', async () => {
      const server = await mockServer.start();
      expect(server).toBeDefined();
      expect(mockServer.server).toBeDefined();

      await mockServer.stop();
      expect(mockServer.server).toBeNull();
    });

    test('should serve mock data', async () => {
      await mockServer.start();

      try {
        const response = await fetch('http://localhost:3002/');
        const data = await response.json();

        expect(response.ok).toBe(true);
        expect(data).toHaveProperty('name');
        expect(data).toHaveProperty('version');
        expect(data).toHaveProperty('endpoints');
      } finally {
        await mockServer.stop();
      }
    });

    test('should handle authentication', async () => {
      await mockServer.start();

      try {
        // Test login
        const loginResponse = await fetch('http://localhost:3002/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'john.doe@example.com',
            password: 'password123'
          })
        });

        const loginData = await loginResponse.json();
        expect(loginResponse.ok).toBe(true);
        expect(loginData.success).toBe(true);
        expect(loginData.data).toHaveProperty('token');
        expect(loginData.data).toHaveProperty('user');

        // Test authenticated request
        const notesResponse = await fetch('http://localhost:3002/api/notes', {
          headers: {
            'Authorization': `Bearer ${loginData.data.token}`
          }
        });

        const notesData = await notesResponse.json();
        expect(notesResponse.ok).toBe(true);
        expect(notesData.success).toBe(true);
        expect(notesData.data).toHaveProperty('items');
      } finally {
        await mockServer.stop();
      }
    });
  });

  describe('Schema Validation', () => {
    test('should initialize schema validation', () => {
      expect(schemaValidation.initialized).toBe(true);
      
      const stats = schemaValidation.getValidationStats();
      expect(stats.initialized).toBe(true);
      expect(stats.specPaths).toBeGreaterThan(0);
      expect(stats.specSchemas).toBeGreaterThan(0);
    });

    test('should find operations by method and path', () => {
      const operation = schemaValidation.findOperation('GET', '/api/notes');
      expect(operation).toBeDefined();
      expect(operation.parameters).toBeDefined();
    });

    test('should match parameterized paths', () => {
      expect(schemaValidation.pathMatches('/api/notes/123', '/api/notes/{id}')).toBe(true);
      expect(schemaValidation.pathMatches('/api/notes', '/api/notes/{id}')).toBe(false);
      expect(schemaValidation.pathMatches('/api/notes/123/comments', '/api/notes/{id}/comments')).toBe(true);
    });

    test('should validate string schemas', () => {
      const schema = {
        type: 'string',
        minLength: 3,
        maxLength: 10,
        pattern: '^[a-zA-Z]+$'
      };

      expect(() => schemaValidation.validateStringSchema('hello', schema, 'test')).not.toThrow();
      expect(() => schemaValidation.validateStringSchema('hi', schema, 'test')).toThrow();
      expect(() => schemaValidation.validateStringSchema('verylongstring', schema, 'test')).toThrow();
      expect(() => schemaValidation.validateStringSchema('hello123', schema, 'test')).toThrow();
    });

    test('should validate number schemas', () => {
      const schema = {
        type: 'number',
        minimum: 0,
        maximum: 100
      };

      expect(() => schemaValidation.validateNumberSchema(50, schema, 'test')).not.toThrow();
      expect(() => schemaValidation.validateNumberSchema(-1, schema, 'test')).toThrow();
      expect(() => schemaValidation.validateNumberSchema(101, schema, 'test')).toThrow();
      expect(() => schemaValidation.validateNumberSchema('50', schema, 'test')).toThrow();
    });

    test('should validate object schemas', async () => {
      const schema = {
        type: 'object',
        required: ['name', 'email'],
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          age: { type: 'number', minimum: 0 }
        }
      };

      const validData = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30
      };

      await expect(schemaValidation.validateObjectSchema(validData, schema, 'test')).resolves.not.toThrow();

      const invalidData = {
        name: 'John Doe'
        // missing required email
      };

      await expect(schemaValidation.validateObjectSchema(invalidData, schema, 'test')).rejects.toThrow();
    });
  });
});