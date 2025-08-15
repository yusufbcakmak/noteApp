const SwaggerParser = require('@apidevtools/swagger-parser');
const SwaggerConfig = require('../config/swagger');
const logger = require('../utils/logger');
const { ValidationError } = require('../utils/errors');

/**
 * Contract validation middleware for OpenAPI specification
 */
class ContractValidation {
  constructor() {
    this.swaggerConfig = new SwaggerConfig();
    this.spec = null;
    this.parser = null;
    this.initialized = false;
  }

  /**
   * Initialize the contract validation
   */
  async init() {
    try {
      this.spec = this.swaggerConfig.getSpec();
      this.parser = new SwaggerParser();
      await this.parser.validate(this.spec);
      this.initialized = true;
      logger.info('Contract validation initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize contract validation:', error);
      throw error;
    }
  }

  /**
   * Validate request against OpenAPI schema
   */
  validateRequest() {
    return (req, res, next) => {
      if (!this.initialized) {
        logger.warn('Contract validation not initialized, skipping request validation');
        return next();
      }

      try {
        const path = this.findMatchingPath(req.path, req.method);
        if (!path) {
          logger.debug(`No OpenAPI path found for ${req.method} ${req.path}`);
          return next();
        }

        const operation = this.spec.paths[path][req.method.toLowerCase()];
        if (!operation) {
          return next();
        }

        // Validate request body if present
        if (req.body && Object.keys(req.body).length > 0) {
          this.validateRequestBody(req.body, operation, req.method, req.path);
        }

        // Validate query parameters
        if (req.query && Object.keys(req.query).length > 0) {
          this.validateQueryParameters(req.query, operation, req.method, req.path);
        }

        // Validate path parameters
        if (req.params && Object.keys(req.params).length > 0) {
          this.validatePathParameters(req.params, operation, req.method, req.path);
        }

        // Store operation info for response validation
        req.openApiOperation = operation;
        req.openApiPath = path;

        next();
      } catch (error) {
        logger.error('Request validation failed:', {
          method: req.method,
          path: req.path,
          error: error.message
        });

        if (error instanceof ValidationError) {
          return next(error);
        }

        next(new ValidationError('Request validation failed', {
          method: req.method,
          path: req.path,
          details: error.message
        }));
      }
    };
  }

  /**
   * Validate response against OpenAPI schema
   */
  validateResponse() {
    return (req, res, next) => {
      if (!this.initialized || !req.openApiOperation) {
        return next();
      }

      // Store original json method
      const originalJson = res.json;

      // Override json method to validate response
      res.json = (data) => {
        try {
          this.validateResponseBody(data, req.openApiOperation, res.statusCode, req.method, req.path);
          logger.debug('Response validation passed', {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode
          });
        } catch (error) {
          logger.error('Response validation failed:', {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            error: error.message
          });

          // In development, we might want to fail the request
          // In production, we log the error but continue
          if (process.env.NODE_ENV === 'development') {
            return originalJson.call(res, {
              success: false,
              error: {
                code: 'RESPONSE_VALIDATION_ERROR',
                message: 'Response validation failed',
                details: error.message
              }
            });
          }
        }

        return originalJson.call(res, data);
      };

      next();
    };
  }

  /**
   * Find matching OpenAPI path for request path
   */
  findMatchingPath(requestPath, method) {
    if (!this.spec || !this.spec.paths) {
      return null;
    }

    // First try exact match
    if (this.spec.paths[requestPath]) {
      return requestPath;
    }

    // Then try pattern matching for parameterized paths
    for (const specPath of Object.keys(this.spec.paths)) {
      if (this.pathMatches(requestPath, specPath)) {
        const pathMethods = this.spec.paths[specPath];
        if (pathMethods[method.toLowerCase()]) {
          return specPath;
        }
      }
    }

    return null;
  }

  /**
   * Check if request path matches OpenAPI path pattern
   */
  pathMatches(requestPath, specPath) {
    // Convert OpenAPI path pattern to regex
    const pattern = specPath
      .replace(/\{[^}]+\}/g, '[^/]+') // Replace {param} with regex pattern
      .replace(/\//g, '\\/'); // Escape forward slashes

    const regex = new RegExp(`^${pattern}$`);
    return regex.test(requestPath);
  }

  /**
   * Validate request body against schema
   */
  validateRequestBody(body, operation, method, path) {
    if (!operation.requestBody || !operation.requestBody.content) {
      return;
    }

    const contentType = 'application/json';
    const schema = operation.requestBody.content[contentType]?.schema;

    if (!schema) {
      return;
    }

    this.validateAgainstSchema(body, schema, `Request body for ${method} ${path}`);
  }

  /**
   * Validate query parameters against schema
   */
  validateQueryParameters(query, operation, method, path) {
    if (!operation.parameters) {
      return;
    }

    const queryParams = operation.parameters.filter(p => p.in === 'query');
    
    for (const param of queryParams) {
      const value = query[param.name];
      
      if (param.required && (value === undefined || value === null)) {
        throw new ValidationError(`Required query parameter '${param.name}' is missing`);
      }

      if (value !== undefined && param.schema) {
        this.validateParameterValue(value, param.schema, param.name, 'query');
      }
    }
  }

  /**
   * Validate path parameters against schema
   */
  validatePathParameters(params, operation, method, path) {
    if (!operation.parameters) {
      return;
    }

    const pathParams = operation.parameters.filter(p => p.in === 'path');
    
    for (const param of pathParams) {
      const value = params[param.name];
      
      if (param.required && (value === undefined || value === null)) {
        throw new ValidationError(`Required path parameter '${param.name}' is missing`);
      }

      if (value !== undefined && param.schema) {
        this.validateParameterValue(value, param.schema, param.name, 'path');
      }
    }
  }

  /**
   * Validate parameter value against schema
   */
  validateParameterValue(value, schema, paramName, paramType) {
    // Basic type validation
    if (schema.type === 'integer' && !Number.isInteger(Number(value))) {
      throw new ValidationError(`${paramType} parameter '${paramName}' must be an integer`);
    }

    if (schema.type === 'number' && isNaN(Number(value))) {
      throw new ValidationError(`${paramType} parameter '${paramName}' must be a number`);
    }

    // Pattern validation
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      throw new ValidationError(`${paramType} parameter '${paramName}' does not match required pattern`);
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      throw new ValidationError(`${paramType} parameter '${paramName}' must be one of: ${schema.enum.join(', ')}`);
    }

    // Range validation
    if (schema.minimum !== undefined && Number(value) < schema.minimum) {
      throw new ValidationError(`${paramType} parameter '${paramName}' must be >= ${schema.minimum}`);
    }

    if (schema.maximum !== undefined && Number(value) > schema.maximum) {
      throw new ValidationError(`${paramType} parameter '${paramName}' must be <= ${schema.maximum}`);
    }
  }

  /**
   * Validate response body against schema
   */
  validateResponseBody(body, operation, statusCode, method, path) {
    if (!operation.responses || !operation.responses[statusCode]) {
      // Check for default response
      if (!operation.responses.default) {
        return;
      }
    }

    const response = operation.responses[statusCode] || operation.responses.default;
    if (!response.content || !response.content['application/json']) {
      return;
    }

    const schema = response.content['application/json'].schema;
    if (!schema) {
      return;
    }

    this.validateAgainstSchema(body, schema, `Response body for ${method} ${path} (${statusCode})`);
  }

  /**
   * Validate data against JSON schema
   */
  validateAgainstSchema(data, schema, context) {
    // Basic schema validation
    if (schema.$ref) {
      // Handle schema references
      const refPath = schema.$ref.replace('#/components/schemas/', '');
      const referencedSchema = this.spec.components?.schemas?.[refPath];
      if (referencedSchema) {
        return this.validateAgainstSchema(data, referencedSchema, context);
      }
    }

    if (schema.type === 'object' && schema.properties) {
      this.validateObjectSchema(data, schema, context);
    } else if (schema.type === 'array' && schema.items) {
      this.validateArraySchema(data, schema, context);
    } else {
      this.validatePrimitiveSchema(data, schema, context);
    }
  }

  /**
   * Validate object against schema
   */
  validateObjectSchema(data, schema, context) {
    if (typeof data !== 'object' || data === null) {
      throw new ValidationError(`${context}: Expected object, got ${typeof data}`);
    }

    // Check required properties
    if (schema.required) {
      for (const requiredProp of schema.required) {
        if (!(requiredProp in data)) {
          throw new ValidationError(`${context}: Missing required property '${requiredProp}'`);
        }
      }
    }

    // Validate properties
    if (schema.properties) {
      for (const [propName, propValue] of Object.entries(data)) {
        const propSchema = schema.properties[propName];
        if (propSchema) {
          this.validateAgainstSchema(propValue, propSchema, `${context}.${propName}`);
        }
      }
    }
  }

  /**
   * Validate array against schema
   */
  validateArraySchema(data, schema, context) {
    if (!Array.isArray(data)) {
      throw new ValidationError(`${context}: Expected array, got ${typeof data}`);
    }

    // Validate array items
    if (schema.items) {
      data.forEach((item, index) => {
        this.validateAgainstSchema(item, schema.items, `${context}[${index}]`);
      });
    }
  }

  /**
   * Validate primitive value against schema
   */
  validatePrimitiveSchema(data, schema, context) {
    // Type validation
    if (schema.type) {
      const expectedType = schema.type;
      const actualType = typeof data;

      if (expectedType === 'integer' && !Number.isInteger(data)) {
        throw new ValidationError(`${context}: Expected integer, got ${actualType}`);
      } else if (expectedType !== 'integer' && expectedType !== actualType) {
        throw new ValidationError(`${context}: Expected ${expectedType}, got ${actualType}`);
      }
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(data)) {
      throw new ValidationError(`${context}: Value must be one of: ${schema.enum.join(', ')}`);
    }

    // Pattern validation for strings
    if (schema.pattern && typeof data === 'string' && !new RegExp(schema.pattern).test(data)) {
      throw new ValidationError(`${context}: Value does not match required pattern`);
    }
  }

  /**
   * Get contract validation report
   */
  async getValidationReport() {
    if (!this.initialized) {
      return { status: 'not_initialized' };
    }

    try {
      await this.parser.validate(this.spec);
      return {
        status: 'valid',
        spec: {
          openapi: this.spec.openapi,
          info: this.spec.info,
          pathCount: Object.keys(this.spec.paths || {}).length,
          schemaCount: Object.keys(this.spec.components?.schemas || {}).length
        }
      };
    } catch (error) {
      return {
        status: 'invalid',
        errors: [error.message]
      };
    }
  }
}

module.exports = ContractValidation;