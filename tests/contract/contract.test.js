/**
 * Auto-generated contract tests from OpenAPI specification
 * Generated on: 2025-08-15T08:05:00.940Z
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

});
