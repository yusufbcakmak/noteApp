/**
 * Contract validation tests
 */

const request = require('supertest');

// Set test database to in-memory for tests
process.env.TEST_DB_PATH = ':memory:';

const { app, initializeRoutes } = require('../../src/app');
const dbConnection = require('../../src/config/database');
const SwaggerConfig = require('../../src/config/swagger');
const ContractValidation = require('../../src/middleware/contractValidation');
const TypeGenerator = require('../../src/utils/typeGenerator');
const ContractTesting = require('../../src/utils/contractTesting');
const AuthService = require('../../src/services/AuthService');

describe('Contract Validation System', () => {
  let authToken;
  let testUser;
  let swaggerConfig;
  let contractValidation;
  let authService;

  beforeAll(async () => {
    // Initialize database connection
    await dbConnection.connect();
    
    // Initialize database tables
    const createUsersTable = `
      CREATE TABLE users (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active INTEGER DEFAULT 1,
        last_login_at DATETIME
      )
    `;

    const createNotesTable = `
      CREATE TABLE notes (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL,
        group_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
        priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `;

    const createGroupsTable = `
      CREATE TABLE groups (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT DEFAULT '#3498db',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `;

    dbConnection.getDatabase().exec(createUsersTable);
    dbConnection.getDatabase().exec(createNotesTable);
    dbConnection.getDatabase().exec(createGroupsTable);

    // Initialize routes
    initializeRoutes();
    
    // Create test user
    authService = new AuthService();
    authService.init();
    
    const userData = {
      email: 'test@example.com',
      password: 'TestPassword123',
      firstName: 'Test',
      lastName: 'User'
    };
    
    const result = await authService.register(userData);
    testUser = result.user;
    authToken = result.token;
    
    swaggerConfig = new SwaggerConfig();
    contractValidation = new ContractValidation();
    await contractValidation.init();
  });

  afterAll(async () => {
    // Cleanup is automatic with in-memory database
  });

  describe('OpenAPI Specification', () => {
    test('should have valid OpenAPI specification', () => {
      const spec = swaggerConfig.getSpec();
      
      expect(spec).toBeDefined();
      expect(spec.openapi).toBe('3.0.0');
      expect(spec.info).toBeDefined();
      expect(spec.info.title).toBe('Note Management API');
      expect(spec.paths).toBeDefined();
      expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
    });

    test('should have required components', () => {
      const spec = swaggerConfig.getSpec();
      
      expect(spec.components).toBeDefined();
      expect(spec.components.schemas).toBeDefined();
      expect(spec.components.responses).toBeDefined();
      expect(spec.components.parameters).toBeDefined();
      expect(spec.components.securitySchemes).toBeDefined();
    });

    test('should have authentication security scheme', () => {
      const spec = swaggerConfig.getSpec();
      
      expect(spec.components.securitySchemes.bearerAuth).toBeDefined();
      expect(spec.components.securitySchemes.bearerAuth.type).toBe('http');
      expect(spec.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
    });

    test('should have all required schemas', () => {
      const spec = swaggerConfig.getSpec();
      const schemas = spec.components.schemas;
      
      const requiredSchemas = [
        'User', 'Note', 'Group', 'CompletedNote',
        'LoginRequest', 'RegisterRequest', 'AuthResponse',
        'CreateNoteRequest', 'UpdateNoteRequest', 'CreateGroupRequest',
        'SuccessResponse', 'ErrorResponse', 'PaginatedResponse'
      ];

      requiredSchemas.forEach(schemaName => {
        expect(schemas[schemaName]).toBeDefined();
      });
    });
  });

  describe('Contract Validation Middleware', () => {
    test('should initialize successfully', async () => {
      const validation = new ContractValidation();
      await expect(validation.init()).resolves.not.toThrow();
      expect(validation.initialized).toBe(true);
    });

    test('should generate validation report', async () => {
      const report = await contractValidation.getValidationReport();
      
      expect(report).toBeDefined();
      expect(report.status).toBe('valid');
      expect(report.spec).toBeDefined();
      expect(report.spec.pathCount).toBeGreaterThan(0);
      expect(report.spec.schemaCount).toBeGreaterThan(0);
    });

    test('should validate request path matching', () => {
      const testCases = [
        { requestPath: '/api/notes', specPath: '/api/notes', expected: true },
        { requestPath: '/api/notes/abc123', specPath: '/api/notes/{id}', expected: true },
        { requestPath: '/api/invalid', specPath: '/api/notes', expected: false }
      ];

      testCases.forEach(({ requestPath, specPath, expected }) => {
        const matches = contractValidation.pathMatches(requestPath, specPath);
        expect(matches).toBe(expected);
      });
    });
  });

  describe('TypeScript Generator', () => {
    test('should initialize successfully', async () => {
      const typeGenerator = new TypeGenerator();
      await expect(typeGenerator.init()).resolves.not.toThrow();
    });

    test('should generate TypeScript interfaces', async () => {
      const typeGenerator = new TypeGenerator();
      await typeGenerator.init();
      
      const interfaces = typeGenerator.generateInterfacesFromSchemas();
      expect(interfaces).toBeDefined();
      expect(Array.isArray(interfaces)).toBe(true);
      expect(interfaces.length).toBeGreaterThan(0);
      
      // Check that User interface is generated
      const userInterface = interfaces.find(i => i.includes('export interface User'));
      expect(userInterface).toBeDefined();
    });

    test('should convert OpenAPI types to TypeScript types', () => {
      const typeGenerator = new TypeGenerator();
      
      const testCases = [
        { schema: { type: 'string' }, expected: 'string' },
        { schema: { type: 'number' }, expected: 'number' },
        { schema: { type: 'boolean' }, expected: 'boolean' },
        { schema: { type: 'array', items: { type: 'string' } }, expected: 'string[]' },
        { schema: { enum: ['a', 'b', 'c'] }, expected: "'a' | 'b' | 'c'" }
      ];

      testCases.forEach(({ schema, expected }) => {
        const result = typeGenerator.getTypeScriptType(schema);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Contract Testing', () => {
    test('should initialize successfully', async () => {
      const contractTesting = new ContractTesting();
      await expect(contractTesting.init()).resolves.not.toThrow();
    });

    test('should generate test path with parameters', () => {
      const contractTesting = new ContractTesting();
      
      const testCases = [
        { pathPattern: '/api/notes', expected: '/api/notes' },
        { pathPattern: '/api/notes/{id}', expected: '/api/notes/a1b2c3d4e5f6789012345678901234ab' },
        { pathPattern: '/api/groups/{id}/notes', expected: '/api/groups/a1b2c3d4e5f6789012345678901234ab/notes' }
      ];

      testCases.forEach(({ pathPattern, expected }) => {
        const result = contractTesting.generateTestPath(pathPattern);
        expect(result).toBe(expected);
      });
    });

    test('should generate sample data from schema', () => {
      const contractTesting = new ContractTesting();
      
      const schema = {
        type: 'object',
        properties: {
          title: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          completed: { type: 'boolean' }
        }
      };

      const sample = contractTesting.generateSampleFromSchema(schema);
      
      expect(sample).toBeDefined();
      expect(typeof sample.title).toBe('string');
      expect(['low', 'medium', 'high']).toContain(sample.priority);
      expect(typeof sample.completed).toBe('boolean');
    });
  });

  describe('API Documentation Endpoints', () => {
    test('should serve OpenAPI specification', async () => {
      const res = await request(app)
        .get('/api/openapi.json')
        .expect(200);

      expect(res.body).toBeDefined();
      expect(res.body.openapi).toBe('3.0.0');
      expect(res.body.info.title).toBe('Note Management API');
    });

    test('should serve contract validation endpoint', async () => {
      const res = await request(app)
        .get('/api/contract/validate')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.status).toBe('valid');
    });

    test('should include documentation links in root endpoint', async () => {
      const res = await request(app)
        .get('/')
        .expect(200);

      expect(res.body.endpoints).toBeDefined();
      expect(res.body.endpoints.docs).toBe('/api-docs');
      expect(res.body.endpoints.openapi).toBe('/api/openapi.json');
      expect(res.body.endpoints.contract).toBe('/api/contract/validate');
    });
  });

  describe('Request/Response Validation', () => {
    test('should validate valid note creation request', async () => {
      const validNote = {
        title: 'Test Note',
        description: 'Test description',
        priority: 'medium'
      };

      const res = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validNote)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.title).toBe(validNote.title);
    });

    test('should reject invalid note creation request', async () => {
      const invalidNote = {
        // Missing required title
        description: 'Test description',
        priority: 'invalid_priority'
      };

      const res = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidNote)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should validate authentication requirements', async () => {
      const res = await request(app)
        .get('/api/notes')
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Schema Consistency', () => {
    test('should have consistent error response format', async () => {
      // Test various error scenarios to ensure consistent format
      const errorTests = [
        { endpoint: '/api/notes', method: 'get', expectedStatus: 401 },
        { endpoint: '/api/notes', method: 'post', body: {}, expectedStatus: 400 },
        { endpoint: '/api/notes/invalid-id', method: 'get', auth: true, expectedStatus: 400 }
      ];

      for (const test of errorTests) {
        const req = request(app)[test.method](test.endpoint);
        
        if (test.auth) {
          req.set('Authorization', `Bearer ${authToken}`);
        }
        
        if (test.body) {
          req.send(test.body);
        }

        const res = await req.expect(test.expectedStatus);

        // Validate error response structure
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBeDefined();
        expect(res.body.error.code).toBeDefined();
        expect(res.body.error.message).toBeDefined();
        expect(res.body.timestamp).toBeDefined();
        expect(res.body.requestId).toBeDefined();
      }
    });

    test('should have consistent success response format', async () => {
      const res = await request(app)
        .get('/api/notes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Validate success response structure
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.items).toBeDefined();
      expect(res.body.data.pagination).toBeDefined();
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });
  });
});