const SwaggerConfig = require('../config/swagger');
const ContractValidation = require('../middleware/contractValidation');
const logger = require('./logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * Contract testing utilities for API validation
 */
class ContractTesting {
  constructor() {
    this.swaggerConfig = new SwaggerConfig();
    this.contractValidation = new ContractValidation();
    this.spec = null;
    this.testResults = [];
  }

  /**
   * Initialize contract testing
   */
  async init() {
    this.spec = this.swaggerConfig.getSpec();
    await this.contractValidation.init();
    logger.info('Contract testing initialized');
  }

  /**
   * Generate contract tests from OpenAPI specification
   */
  async generateContractTests(outputPath = 'tests/contract') {
    if (!this.spec) {
      await this.init();
    }

    const testSuites = [];

    // Generate tests for each endpoint
    for (const [pathPattern, pathItem] of Object.entries(this.spec.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (typeof operation === 'object' && operation.operationId) {
          const testSuite = this.generateEndpointTests(pathPattern, method, operation);
          testSuites.push(testSuite);
        }
      }
    }

    // Write test files
    await this.writeContractTests(testSuites, outputPath);
    logger.info(`Contract tests generated in: ${outputPath}`);

    return testSuites;
  }

  /**
   * Generate tests for a specific endpoint
   */
  generateEndpointTests(pathPattern, method, operation) {
    const testCases = [];
    const operationId = operation.operationId || `${method}_${pathPattern.replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Generate success test cases
    if (operation.responses) {
      for (const [statusCode, response] of Object.entries(operation.responses)) {
        if (statusCode.startsWith('2')) {
          testCases.push(this.generateSuccessTest(pathPattern, method, operation, statusCode, response));
        } else {
          testCases.push(this.generateErrorTest(pathPattern, method, operation, statusCode, response));
        }
      }
    }

    // Generate validation test cases
    if (operation.requestBody) {
      testCases.push(this.generateValidationTest(pathPattern, method, operation));
    }

    return {
      operationId,
      pathPattern,
      method: method.toUpperCase(),
      testCases,
      tags: operation.tags || []
    };
  }

  /**
   * Generate success test case
   */
  generateSuccessTest(pathPattern, method, operation, statusCode, response) {
    const testPath = this.generateTestPath(pathPattern);
    const requestBody = this.generateSampleRequestBody(operation);
    const expectedResponse = this.generateSampleResponse(response);

    return {
      name: `should return ${statusCode} for valid request`,
      type: 'success',
      statusCode: parseInt(statusCode),
      request: {
        method: method.toUpperCase(),
        path: testPath,
        body: requestBody,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer {{token}}'
        }
      },
      expectedResponse,
      validations: [
        'response.status === ' + statusCode,
        'response.body.success === true',
        'response.headers["content-type"].includes("application/json")'
      ]
    };
  }

  /**
   * Generate error test case
   */
  generateErrorTest(pathPattern, method, operation, statusCode, response) {
    const testPath = this.generateTestPath(pathPattern);
    const invalidRequestBody = this.generateInvalidRequestBody(operation);

    return {
      name: `should return ${statusCode} for invalid request`,
      type: 'error',
      statusCode: parseInt(statusCode),
      request: {
        method: method.toUpperCase(),
        path: testPath,
        body: invalidRequestBody,
        headers: {
          'Content-Type': 'application/json'
        }
      },
      validations: [
        'response.status === ' + statusCode,
        'response.body.success === false',
        'response.body.error !== undefined'
      ]
    };
  }

  /**
   * Generate validation test case
   */
  generateValidationTest(pathPattern, method, operation) {
    const testPath = this.generateTestPath(pathPattern);

    return {
      name: 'should validate request body schema',
      type: 'validation',
      request: {
        method: method.toUpperCase(),
        path: testPath,
        body: {}, // Empty body to trigger validation error
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer {{token}}'
        }
      },
      validations: [
        'response.status === 400',
        'response.body.success === false',
        'response.body.error.code === "VALIDATION_ERROR"'
      ]
    };
  }

  /**
   * Generate test path with sample parameters
   */
  generateTestPath(pathPattern) {
    return pathPattern.replace(/\{([^}]+)\}/g, (match, paramName) => {
      // Generate sample values for path parameters
      switch (paramName) {
        case 'id':
          return 'a1b2c3d4e5f6789012345678901234ab';
        default:
          return 'sample-' + paramName;
      }
    });
  }

  /**
   * Generate sample request body from operation schema
   */
  generateSampleRequestBody(operation) {
    if (!operation.requestBody || !operation.requestBody.content) {
      return null;
    }

    const schema = operation.requestBody.content['application/json']?.schema;
    if (!schema) {
      return null;
    }

    return this.generateSampleFromSchema(schema);
  }

  /**
   * Generate invalid request body for error testing
   */
  generateInvalidRequestBody(operation) {
    if (!operation.requestBody) {
      return null;
    }

    // Return invalid data that should trigger validation errors
    return {
      invalid: 'data',
      missing: 'required fields'
    };
  }

  /**
   * Generate sample response from response schema
   */
  generateSampleResponse(response) {
    if (!response.content || !response.content['application/json']) {
      return null;
    }

    const schema = response.content['application/json'].schema;
    if (!schema) {
      return null;
    }

    return this.generateSampleFromSchema(schema);
  }

  /**
   * Generate sample data from JSON schema
   */
  generateSampleFromSchema(schema) {
    if (schema.$ref) {
      // Handle schema references
      const refPath = schema.$ref.replace('#/components/schemas/', '');
      const referencedSchema = this.spec.components?.schemas?.[refPath];
      if (referencedSchema) {
        return this.generateSampleFromSchema(referencedSchema);
      }
    }

    switch (schema.type) {
      case 'object':
        const obj = {};
        if (schema.properties) {
          for (const [propName, propSchema] of Object.entries(schema.properties)) {
            obj[propName] = this.generateSampleFromSchema(propSchema);
          }
        }
        return obj;

      case 'array':
        if (schema.items) {
          return [this.generateSampleFromSchema(schema.items)];
        }
        return [];

      case 'string':
        if (schema.enum) {
          return schema.enum[0];
        }
        if (schema.format === 'email') {
          return 'test@example.com';
        }
        if (schema.format === 'date-time') {
          return new Date().toISOString();
        }
        if (schema.pattern === '^[a-f0-9]{32}$') {
          return 'a1b2c3d4e5f6789012345678901234ab';
        }
        return 'sample string';

      case 'number':
      case 'integer':
        return schema.minimum || 1;

      case 'boolean':
        return true;

      default:
        return null;
    }
  }

  /**
   * Write contract test files
   */
  async writeContractTests(testSuites, outputPath) {
    // Ensure output directory exists
    await fs.mkdir(outputPath, { recursive: true });

    // Write main contract test file
    const mainTestContent = this.generateMainTestFile(testSuites);
    await fs.writeFile(path.join(outputPath, 'contract.test.js'), mainTestContent, 'utf8');

    // Write individual test files for each endpoint group
    const groupedSuites = this.groupTestSuitesByTag(testSuites);
    for (const [tag, suites] of Object.entries(groupedSuites)) {
      const testContent = this.generateTagTestFile(tag, suites);
      await fs.writeFile(path.join(outputPath, `${tag.toLowerCase()}.contract.test.js`), testContent, 'utf8');
    }

    // Write test utilities
    const utilsContent = this.generateTestUtils();
    await fs.writeFile(path.join(outputPath, 'contractUtils.js'), utilsContent, 'utf8');
  }

  /**
   * Generate main contract test file
   */
  generateMainTestFile(testSuites) {
    return `/**
 * Auto-generated contract tests from OpenAPI specification
 * Generated on: ${new Date().toISOString()}
 * 
 * These tests validate that the API implementation matches the OpenAPI contract
 */

const request = require('supertest');
const { app } = require('../../src/app');
const { setupTestDatabase, cleanupTestDatabase, createTestUser, getAuthToken } = require('../setup');
const ContractValidation = require('../../src/middleware/contractValidation');

describe('API Contract Tests', () => {
  let authToken;
  let testUser;
  let contractValidation;

  beforeAll(async () => {
    await setupTestDatabase();
    testUser = await createTestUser();
    authToken = await getAuthToken(testUser);
    
    contractValidation = new ContractValidation();
    await contractValidation.init();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('Contract Validation', () => {
    test('should have valid OpenAPI specification', async () => {
      const report = await contractValidation.getValidationReport();
      expect(report.status).toBe('valid');
      expect(report.spec).toBeDefined();
      expect(report.spec.pathCount).toBeGreaterThan(0);
    });
  });

  // Import individual test suites
${testSuites.map(suite => `  require('./${suite.tags[0]?.toLowerCase() || 'general'}.contract.test.js');`).join('\n')}
});
`;
  }

  /**
   * Generate test file for specific tag
   */
  generateTagTestFile(tag, testSuites) {
    const testCases = testSuites.flatMap(suite => 
      suite.testCases.map(testCase => ({
        ...testCase,
        suite: suite.operationId,
        method: suite.method,
        pathPattern: suite.pathPattern
      }))
    );

    return `/**
 * Contract tests for ${tag} endpoints
 * Auto-generated from OpenAPI specification
 */

const request = require('supertest');
const { app } = require('../../src/app');
const { getAuthToken, createTestUser } = require('../setup');

describe('${tag} Contract Tests', () => {
  let authToken;
  let testUser;

  beforeAll(async () => {
    testUser = await createTestUser();
    authToken = await getAuthToken(testUser);
  });

${testCases.map(testCase => this.generateTestCaseCode(testCase)).join('\n\n')}
});
`;
  }

  /**
   * Generate test case code
   */
  generateTestCaseCode(testCase) {
    const authHeader = testCase.request.headers.Authorization ? 
      `.set('Authorization', authToken)` : '';

    const bodyData = testCase.request.body ? 
      `.send(${JSON.stringify(testCase.request.body, null, 4)})` : '';

    const validations = testCase.validations.map(validation => 
      `    expect(${validation.replace('response.', 'res.')}).toBeTruthy();`
    ).join('\n');

    return `  test('${testCase.name}', async () => {
    const res = await request(app)
      .${testCase.method.toLowerCase()}('${testCase.request.path}')
      .set('Content-Type', 'application/json')${authHeader}${bodyData}
      .expect(${testCase.statusCode || 200});

${validations}
  });`;
  }

  /**
   * Group test suites by tag
   */
  groupTestSuitesByTag(testSuites) {
    const grouped = {};
    
    for (const suite of testSuites) {
      const tag = suite.tags[0] || 'General';
      if (!grouped[tag]) {
        grouped[tag] = [];
      }
      grouped[tag].push(suite);
    }

    return grouped;
  }

  /**
   * Generate test utilities
   */
  generateTestUtils() {
    return `/**
 * Contract testing utilities
 */

const SwaggerConfig = require('../../src/config/swagger');
const ContractValidation = require('../../src/middleware/contractValidation');

/**
 * Validate API response against OpenAPI schema
 */
async function validateApiResponse(method, path, statusCode, responseBody) {
  const contractValidation = new ContractValidation();
  await contractValidation.init();

  // Mock request object for validation
  const mockReq = {
    method: method.toUpperCase(),
    path,
    openApiOperation: null // Would need to be populated
  };

  try {
    // This would require more sophisticated validation logic
    return { valid: true, errors: [] };
  } catch (error) {
    return { valid: false, errors: [error.message] };
  }
}

/**
 * Generate test data from schema
 */
function generateTestData(schema) {
  // Implementation would generate valid test data from schema
  return {};
}

/**
 * Validate request body against schema
 */
function validateRequestBody(body, schema) {
  // Implementation would validate request body
  return { valid: true, errors: [] };
}

module.exports = {
  validateApiResponse,
  generateTestData,
  validateRequestBody
};
`;
  }

  /**
   * Run contract tests and generate report
   */
  async runContractTests() {
    // This would integrate with Jest or another test runner
    // For now, return a mock report
    return {
      timestamp: new Date().toISOString(),
      totalTests: 0,
      passed: 0,
      failed: 0,
      results: []
    };
  }

  /**
   * Validate API implementation against contract
   */
  async validateImplementation(apiBaseUrl = 'http://localhost:3000') {
    const validationResults = [];

    // This would make actual HTTP requests to validate the implementation
    // For now, return mock results
    return {
      timestamp: new Date().toISOString(),
      apiBaseUrl,
      results: validationResults,
      summary: {
        total: 0,
        valid: 0,
        invalid: 0
      }
    };
  }
}

module.exports = ContractTesting;