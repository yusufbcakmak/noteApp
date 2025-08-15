const SwaggerConfig = require('../config/swagger');
const logger = require('../utils/logger');
const { ValidationError } = require('../utils/errors');

/**
 * Enhanced schema validation middleware for request/response validation
 */
class SchemaValidation {
  constructor() {
    this.swaggerConfig = new SwaggerConfig();
    this.spec = null;
    this.validationCache = new Map();
    this.initialized = false;
  }

  /**
   * Initialize schema validation
   */
  async init() {
    this.spec = this.swaggerConfig.getSpec();
    this.initialized = true;
    logger.info('Schema validation initialized');
  }

  /**
   * Validate request schema
   */
  validateRequest() {
    return async (req, res, next) => {
      if (!this.initialized) {
        logger.warn('Schema validation not initialized, skipping');
        return next();
      }

      try {
        const operation = this.findOperation(req.method, req.route?.path || req.path);
        if (!operation) {
          return next();
        }

        // Validate request body
        if (req.body && Object.keys(req.body).length > 0) {
          await this.validateRequestBody(req.body, operation, req);
        }

        // Validate query parameters
        if (req.query && Object.keys(req.query).length > 0) {
          await this.validateQueryParameters(req.query, operation, req);
        }

        // Validate path parameters
        if (req.params && Object.keys(req.params).length > 0) {
          await this.validatePathParameters(req.params, operation, req);
        }

        // Store operation for response validation
        req.schemaOperation = operation;
        next();
      } catch (error) {
        logger.error('Request schema validation failed:', {
          method: req.method,
          path: req.path,
          error: error.message
        });

        if (error instanceof ValidationError) {
          return next(error);
        }

        next(new ValidationError('Request schema validation failed', {
          details: error.message
        }));
      }
    };
  }

  /**
   * Validate response schema
   */
  validateResponse() {
    return (req, res, next) => {
      if (!this.initialized || !req.schemaOperation) {
        return next();
      }

      const originalJson = res.json;
      const originalSend = res.send;

      // Override json method
      res.json = (data) => {
        try {
          this.validateResponseData(data, req.schemaOperation, res.statusCode, req);
        } catch (error) {
          logger.error('Response schema validation failed:', {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            error: error.message
          });

          // In development, return validation error
          if (process.env.NODE_ENV === 'development') {
            return originalJson.call(res, {
              success: false,
              error: {
                code: 'RESPONSE_SCHEMA_VALIDATION_ERROR',
                message: 'Response does not match API contract',
                details: error.message
              }
            });
          }
        }

        return originalJson.call(res, data);
      };

      // Override send method for non-JSON responses
      res.send = (data) => {
        if (res.get('Content-Type')?.includes('application/json')) {
          try {
            const jsonData = typeof data === 'string' ? JSON.parse(data) : data;
            this.validateResponseData(jsonData, req.schemaOperation, res.statusCode, req);
          } catch (error) {
            logger.error('Response schema validation failed:', {
              method: req.method,
              path: req.path,
              statusCode: res.statusCode,
              error: error.message
            });
          }
        }

        return originalSend.call(res, data);
      };

      next();
    };
  }

  /**
   * Find operation in OpenAPI spec
   */
  findOperation(method, path) {
    if (!this.spec || !this.spec.paths) {
      return null;
    }

    // Try exact match first
    const exactPath = this.spec.paths[path];
    if (exactPath && exactPath[method.toLowerCase()]) {
      return exactPath[method.toLowerCase()];
    }

    // Try pattern matching for parameterized paths
    for (const [specPath, pathItem] of Object.entries(this.spec.paths)) {
      if (this.pathMatches(path, specPath)) {
        const operation = pathItem[method.toLowerCase()];
        if (operation) {
          return operation;
        }
      }
    }

    return null;
  }

  /**
   * Check if paths match (considering parameters)
   */
  pathMatches(actualPath, specPath) {
    const actualParts = actualPath.split('/').filter(p => p);
    const specParts = specPath.split('/').filter(p => p);

    if (actualParts.length !== specParts.length) {
      return false;
    }

    for (let i = 0; i < actualParts.length; i++) {
      const actualPart = actualParts[i];
      const specPart = specParts[i];

      // If spec part is a parameter, it matches any actual part
      if (specPart.startsWith('{') && specPart.endsWith('}')) {
        continue;
      }

      // Otherwise, parts must match exactly
      if (actualPart !== specPart) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate request body
   */
  async validateRequestBody(body, operation, req) {
    if (!operation.requestBody || !operation.requestBody.content) {
      return;
    }

    const contentType = req.get('Content-Type') || 'application/json';
    const mediaType = this.getMediaType(contentType);
    const schema = operation.requestBody.content[mediaType]?.schema;

    if (!schema) {
      return;
    }

    await this.validateDataAgainstSchema(body, schema, 'Request body');
  }

  /**
   * Validate query parameters
   */
  async validateQueryParameters(query, operation, req) {
    if (!operation.parameters) {
      return;
    }

    const queryParams = operation.parameters.filter(p => p.in === 'query');
    
    for (const param of queryParams) {
      const value = query[param.name];
      
      if (param.required && (value === undefined || value === null || value === '')) {
        throw new ValidationError(`Required query parameter '${param.name}' is missing`);
      }

      if (value !== undefined && value !== null && value !== '') {
        await this.validateParameterValue(value, param, 'query');
      }
    }
  }

  /**
   * Validate path parameters
   */
  async validatePathParameters(params, operation, req) {
    if (!operation.parameters) {
      return;
    }

    const pathParams = operation.parameters.filter(p => p.in === 'path');
    
    for (const param of pathParams) {
      const value = params[param.name];
      
      if (param.required && (value === undefined || value === null)) {
        throw new ValidationError(`Required path parameter '${param.name}' is missing`);
      }

      if (value !== undefined && value !== null) {
        await this.validateParameterValue(value, param, 'path');
      }
    }
  }

  /**
   * Validate parameter value
   */
  async validateParameterValue(value, param, paramType) {
    if (!param.schema) {
      return;
    }

    try {
      await this.validateDataAgainstSchema(value, param.schema, `${paramType} parameter '${param.name}'`);
    } catch (error) {
      throw new ValidationError(`${paramType} parameter '${param.name}' validation failed: ${error.message}`);
    }
  }

  /**
   * Validate response data
   */
  validateResponseData(data, operation, statusCode, req) {
    if (!operation.responses) {
      return;
    }

    const response = operation.responses[statusCode] || operation.responses.default;
    if (!response || !response.content) {
      return;
    }

    const schema = response.content['application/json']?.schema;
    if (!schema) {
      return;
    }

    this.validateDataAgainstSchema(data, schema, `Response (${statusCode})`);
  }

  /**
   * Validate data against JSON schema
   */
  async validateDataAgainstSchema(data, schema, context) {
    // Handle schema references
    if (schema.$ref) {
      const refPath = schema.$ref.replace('#/components/schemas/', '');
      const referencedSchema = this.spec.components?.schemas?.[refPath];
      if (referencedSchema) {
        return this.validateDataAgainstSchema(data, referencedSchema, context);
      }
    }

    // Validate based on schema type
    switch (schema.type) {
      case 'object':
        await this.validateObjectSchema(data, schema, context);
        break;
      case 'array':
        await this.validateArraySchema(data, schema, context);
        break;
      case 'string':
        this.validateStringSchema(data, schema, context);
        break;
      case 'number':
      case 'integer':
        this.validateNumberSchema(data, schema, context);
        break;
      case 'boolean':
        this.validateBooleanSchema(data, schema, context);
        break;
      default:
        // Handle schemas without explicit type
        if (schema.properties) {
          await this.validateObjectSchema(data, schema, context);
        } else if (schema.items) {
          await this.validateArraySchema(data, schema, context);
        }
    }
  }

  /**
   * Validate object schema
   */
  async validateObjectSchema(data, schema, context) {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
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
          await this.validateDataAgainstSchema(propValue, propSchema, `${context}.${propName}`);
        } else if (schema.additionalProperties === false) {
          throw new ValidationError(`${context}: Additional property '${propName}' not allowed`);
        }
      }
    }

    // Check minimum/maximum properties
    if (schema.minProperties !== undefined && Object.keys(data).length < schema.minProperties) {
      throw new ValidationError(`${context}: Object must have at least ${schema.minProperties} properties`);
    }

    if (schema.maxProperties !== undefined && Object.keys(data).length > schema.maxProperties) {
      throw new ValidationError(`${context}: Object must have at most ${schema.maxProperties} properties`);
    }
  }

  /**
   * Validate array schema
   */
  async validateArraySchema(data, schema, context) {
    if (!Array.isArray(data)) {
      throw new ValidationError(`${context}: Expected array, got ${typeof data}`);
    }

    // Check array length constraints
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      throw new ValidationError(`${context}: Array must have at least ${schema.minItems} items`);
    }

    if (schema.maxItems !== undefined && data.length > schema.maxItems) {
      throw new ValidationError(`${context}: Array must have at most ${schema.maxItems} items`);
    }

    // Validate array items
    if (schema.items) {
      for (let i = 0; i < data.length; i++) {
        await this.validateDataAgainstSchema(data[i], schema.items, `${context}[${i}]`);
      }
    }

    // Check uniqueness if required
    if (schema.uniqueItems) {
      const uniqueItems = new Set(data.map(item => JSON.stringify(item)));
      if (uniqueItems.size !== data.length) {
        throw new ValidationError(`${context}: Array items must be unique`);
      }
    }
  }

  /**
   * Validate string schema
   */
  validateStringSchema(data, schema, context) {
    if (typeof data !== 'string') {
      throw new ValidationError(`${context}: Expected string, got ${typeof data}`);
    }

    // Length constraints
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      throw new ValidationError(`${context}: String must be at least ${schema.minLength} characters long`);
    }

    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      throw new ValidationError(`${context}: String must be at most ${schema.maxLength} characters long`);
    }

    // Pattern validation
    if (schema.pattern) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(data)) {
        throw new ValidationError(`${context}: String does not match required pattern`);
      }
    }

    // Format validation
    if (schema.format) {
      this.validateStringFormat(data, schema.format, context);
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(data)) {
      throw new ValidationError(`${context}: Value must be one of: ${schema.enum.join(', ')}`);
    }
  }

  /**
   * Validate string format
   */
  validateStringFormat(data, format, context) {
    const formatValidators = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      uri: /^https?:\/\/.+/,
      'date-time': /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
      date: /^\d{4}-\d{2}-\d{2}$/,
      time: /^\d{2}:\d{2}:\d{2}$/,
      uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    };

    const validator = formatValidators[format];
    if (validator && !validator.test(data)) {
      throw new ValidationError(`${context}: Invalid ${format} format`);
    }
  }

  /**
   * Validate number schema
   */
  validateNumberSchema(data, schema, context) {
    const isInteger = schema.type === 'integer';
    
    if (typeof data !== 'number' || (isInteger && !Number.isInteger(data))) {
      throw new ValidationError(`${context}: Expected ${schema.type}, got ${typeof data}`);
    }

    // Range validation
    if (schema.minimum !== undefined && data < schema.minimum) {
      throw new ValidationError(`${context}: Value must be >= ${schema.minimum}`);
    }

    if (schema.maximum !== undefined && data > schema.maximum) {
      throw new ValidationError(`${context}: Value must be <= ${schema.maximum}`);
    }

    if (schema.exclusiveMinimum !== undefined && data <= schema.exclusiveMinimum) {
      throw new ValidationError(`${context}: Value must be > ${schema.exclusiveMinimum}`);
    }

    if (schema.exclusiveMaximum !== undefined && data >= schema.exclusiveMaximum) {
      throw new ValidationError(`${context}: Value must be < ${schema.exclusiveMaximum}`);
    }

    // Multiple validation
    if (schema.multipleOf !== undefined && data % schema.multipleOf !== 0) {
      throw new ValidationError(`${context}: Value must be a multiple of ${schema.multipleOf}`);
    }
  }

  /**
   * Validate boolean schema
   */
  validateBooleanSchema(data, schema, context) {
    if (typeof data !== 'boolean') {
      throw new ValidationError(`${context}: Expected boolean, got ${typeof data}`);
    }
  }

  /**
   * Get media type from content type
   */
  getMediaType(contentType) {
    return contentType.split(';')[0].trim();
  }

  /**
   * Get validation statistics
   */
  getValidationStats() {
    return {
      initialized: this.initialized,
      cacheSize: this.validationCache.size,
      specPaths: this.spec ? Object.keys(this.spec.paths || {}).length : 0,
      specSchemas: this.spec ? Object.keys(this.spec.components?.schemas || {}).length : 0
    };
  }
}

module.exports = SchemaValidation;