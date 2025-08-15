const SwaggerConfig = require('../config/swagger');
const logger = require('./logger');
const { ValidationError } = require('./errors');

/**
 * Runtime validation tools for API requests and responses
 */
class RuntimeValidation {
  constructor() {
    this.swaggerConfig = new SwaggerConfig();
    this.spec = null;
    this.validationStats = {
      totalRequests: 0,
      validRequests: 0,
      invalidRequests: 0,
      totalResponses: 0,
      validResponses: 0,
      invalidResponses: 0,
      errors: []
    };
    this.validationRules = new Map();
    this.initialized = false;
  }

  /**
   * Initialize runtime validation
   */
  async init() {
    this.spec = this.swaggerConfig.getSpec();
    this.setupValidationRules();
    this.initialized = true;
    logger.info('Runtime validation initialized');
  }

  /**
   * Setup validation rules from OpenAPI spec
   */
  setupValidationRules() {
    if (!this.spec || !this.spec.paths) {
      return;
    }

    for (const [pathPattern, pathItem] of Object.entries(this.spec.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (typeof operation === 'object' && method !== 'parameters') {
          const key = `${method.toUpperCase()} ${pathPattern}`;
          
          this.validationRules.set(key, {
            path: pathPattern,
            method: method.toUpperCase(),
            operation,
            requestValidation: this.buildRequestValidation(operation),
            responseValidation: this.buildResponseValidation(operation)
          });
        }
      }
    }

    logger.info(`Setup validation rules for ${this.validationRules.size} endpoints`);
  }

  /**
   * Build request validation rules
   */
  buildRequestValidation(operation) {
    const rules = {
      parameters: {},
      body: null,
      headers: {},
      security: operation.security || []
    };

    // Parameter validation rules
    if (operation.parameters) {
      for (const param of operation.parameters) {
        rules.parameters[param.name] = {
          in: param.in,
          required: param.required || false,
          schema: param.schema,
          description: param.description
        };
      }
    }

    // Request body validation rules
    if (operation.requestBody) {
      const mediaType = operation.requestBody.content['application/json'];
      if (mediaType && mediaType.schema) {
        rules.body = {
          required: operation.requestBody.required || false,
          schema: mediaType.schema
        };
      }
    }

    return rules;
  }

  /**
   * Build response validation rules
   */
  buildResponseValidation(operation) {
    const rules = {};

    if (operation.responses) {
      for (const [statusCode, response] of Object.entries(operation.responses)) {
        const mediaType = response.content?.['application/json'];
        if (mediaType && mediaType.schema) {
          rules[statusCode] = {
            description: response.description,
            schema: mediaType.schema,
            headers: response.headers || {}
          };
        }
      }
    }

    return rules;
  }

  /**
   * Runtime request validation middleware
   */
  validateRequest() {
    return async (req, res, next) => {
      if (!this.initialized) {
        await this.init();
      }

      this.validationStats.totalRequests++;

      try {
        const validationRule = this.findValidationRule(req.method, req.path);
        if (!validationRule) {
          // No validation rule found, skip validation
          return next();
        }

        await this.validateRequestData(req, validationRule);
        
        this.validationStats.validRequests++;
        req.validationPassed = true;
        
        logger.debug('Request validation passed', {
          method: req.method,
          path: req.path
        });

        next();
      } catch (error) {
        this.validationStats.invalidRequests++;
        this.validationStats.errors.push({
          timestamp: new Date().toISOString(),
          type: 'request_validation',
          method: req.method,
          path: req.path,
          error: error.message
        });

        logger.error('Request validation failed', {
          method: req.method,
          path: req.path,
          error: error.message
        });

        if (error instanceof ValidationError) {
          return next(error);
        }

        next(new ValidationError('Request validation failed', {
          details: error.message
        }));
      }
    };
  }

  /**
   * Runtime response validation middleware
   */
  validateResponse() {
    return (req, res, next) => {
      if (!this.initialized || !req.validationPassed) {
        return next();
      }

      const originalJson = res.json;
      const originalSend = res.send;

      // Override json method
      res.json = (data) => {
        this.validationStats.totalResponses++;

        try {
          const validationRule = this.findValidationRule(req.method, req.path);
          if (validationRule) {
            this.validateResponseData(data, res.statusCode, validationRule);
            this.validationStats.validResponses++;
            
            logger.debug('Response validation passed', {
              method: req.method,
              path: req.path,
              statusCode: res.statusCode
            });
          }
        } catch (error) {
          this.validationStats.invalidResponses++;
          this.validationStats.errors.push({
            timestamp: new Date().toISOString(),
            type: 'response_validation',
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            error: error.message
          });

          logger.error('Response validation failed', {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            error: error.message
          });

          // In development, add validation error to response
          if (process.env.NODE_ENV === 'development') {
            data = {
              ...data,
              _validationError: {
                message: 'Response validation failed',
                details: error.message
              }
            };
          }
        }

        return originalJson.call(res, data);
      };

      // Override send method for non-JSON responses
      res.send = (data) => {
        if (res.get('Content-Type')?.includes('application/json')) {
          try {
            const jsonData = typeof data === 'string' ? JSON.parse(data) : data;
            return res.json(jsonData);
          } catch (parseError) {
            logger.warn('Failed to parse response as JSON for validation', {
              method: req.method,
              path: req.path,
              error: parseError.message
            });
          }
        }

        return originalSend.call(res, data);
      };

      next();
    };
  }

  /**
   * Find validation rule for request
   */
  findValidationRule(method, path) {
    // Try exact match first
    const exactKey = `${method} ${path}`;
    if (this.validationRules.has(exactKey)) {
      return this.validationRules.get(exactKey);
    }

    // Try pattern matching for parameterized paths
    for (const [key, rule] of this.validationRules) {
      if (rule.method === method && this.pathMatches(path, rule.path)) {
        return rule;
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
   * Validate request data
   */
  async validateRequestData(req, validationRule) {
    const { requestValidation } = validationRule;

    // Validate parameters
    await this.validateParameters(req, requestValidation.parameters);

    // Validate request body
    if (requestValidation.body) {
      await this.validateRequestBody(req.body, requestValidation.body);
    }

    // Validate security
    if (requestValidation.security.length > 0) {
      this.validateSecurity(req, requestValidation.security);
    }
  }

  /**
   * Validate parameters
   */
  async validateParameters(req, parameterRules) {
    for (const [paramName, rule] of Object.entries(parameterRules)) {
      let value;

      switch (rule.in) {
        case 'query':
          value = req.query[paramName];
          break;
        case 'path':
          value = req.params[paramName];
          break;
        case 'header':
          value = req.get(paramName);
          break;
        default:
          continue;
      }

      // Check required parameters
      if (rule.required && (value === undefined || value === null || value === '')) {
        throw new ValidationError(`Required ${rule.in} parameter '${paramName}' is missing`);
      }

      // Validate parameter value if present
      if (value !== undefined && value !== null && value !== '' && rule.schema) {
        await this.validateValue(value, rule.schema, `${rule.in} parameter '${paramName}'`);
      }
    }
  }

  /**
   * Validate request body
   */
  async validateRequestBody(body, bodyRule) {
    if (bodyRule.required && (!body || Object.keys(body).length === 0)) {
      throw new ValidationError('Request body is required');
    }

    if (body && Object.keys(body).length > 0 && bodyRule.schema) {
      await this.validateValue(body, bodyRule.schema, 'Request body');
    }
  }

  /**
   * Validate security
   */
  validateSecurity(req, securityRules) {
    if (securityRules.length === 0) {
      return; // No security required
    }

    // Check if any security scheme is satisfied
    let securitySatisfied = false;

    for (const securityRequirement of securityRules) {
      for (const [schemeName, scopes] of Object.entries(securityRequirement)) {
        const scheme = this.spec.components?.securitySchemes?.[schemeName];
        if (scheme) {
          if (this.checkSecurityScheme(req, scheme, scopes)) {
            securitySatisfied = true;
            break;
          }
        }
      }
      if (securitySatisfied) break;
    }

    if (!securitySatisfied) {
      throw new ValidationError('Authentication required');
    }
  }

  /**
   * Check security scheme
   */
  checkSecurityScheme(req, scheme, scopes) {
    switch (scheme.type) {
      case 'http':
        if (scheme.scheme === 'bearer') {
          const authHeader = req.get('Authorization');
          return authHeader && authHeader.startsWith('Bearer ');
        }
        break;
      case 'apiKey':
        if (scheme.in === 'header') {
          return !!req.get(scheme.name);
        } else if (scheme.in === 'query') {
          return !!req.query[scheme.name];
        }
        break;
    }
    return false;
  }

  /**
   * Validate response data
   */
  validateResponseData(data, statusCode, validationRule) {
    const { responseValidation } = validationRule;
    const responseRule = responseValidation[statusCode] || responseValidation.default;

    if (!responseRule) {
      return; // No validation rule for this status code
    }

    if (responseRule.schema) {
      this.validateValue(data, responseRule.schema, `Response (${statusCode})`);
    }
  }

  /**
   * Validate value against schema
   */
  async validateValue(value, schema, context) {
    // Handle schema references
    if (schema.$ref) {
      const refPath = schema.$ref.replace('#/components/schemas/', '');
      const referencedSchema = this.spec.components?.schemas?.[refPath];
      if (referencedSchema) {
        return this.validateValue(value, referencedSchema, context);
      }
    }

    // Type validation
    if (schema.type) {
      this.validateType(value, schema.type, context);
    }

    // Format validation
    if (schema.format) {
      this.validateFormat(value, schema.format, context);
    }

    // Enum validation
    if (schema.enum) {
      this.validateEnum(value, schema.enum, context);
    }

    // Pattern validation
    if (schema.pattern) {
      this.validatePattern(value, schema.pattern, context);
    }

    // Range validation
    this.validateRange(value, schema, context);

    // Object validation
    if (schema.type === 'object' || schema.properties) {
      await this.validateObject(value, schema, context);
    }

    // Array validation
    if (schema.type === 'array' || schema.items) {
      await this.validateArray(value, schema, context);
    }
  }

  /**
   * Validate type
   */
  validateType(value, expectedType, context) {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    
    if (expectedType === 'integer') {
      if (!Number.isInteger(value)) {
        throw new ValidationError(`${context}: Expected integer, got ${actualType}`);
      }
    } else if (expectedType !== actualType) {
      throw new ValidationError(`${context}: Expected ${expectedType}, got ${actualType}`);
    }
  }

  /**
   * Validate format
   */
  validateFormat(value, format, context) {
    if (typeof value !== 'string') {
      return; // Format validation only applies to strings
    }

    const formatValidators = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      uri: /^https?:\/\/.+/,
      'date-time': /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
      date: /^\d{4}-\d{2}-\d{2}$/,
      uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    };

    const validator = formatValidators[format];
    if (validator && !validator.test(value)) {
      throw new ValidationError(`${context}: Invalid ${format} format`);
    }
  }

  /**
   * Validate enum
   */
  validateEnum(value, enumValues, context) {
    if (!enumValues.includes(value)) {
      throw new ValidationError(`${context}: Value must be one of: ${enumValues.join(', ')}`);
    }
  }

  /**
   * Validate pattern
   */
  validatePattern(value, pattern, context) {
    if (typeof value === 'string' && !new RegExp(pattern).test(value)) {
      throw new ValidationError(`${context}: Value does not match required pattern`);
    }
  }

  /**
   * Validate range
   */
  validateRange(value, schema, context) {
    if (typeof value === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        throw new ValidationError(`${context}: Value must be >= ${schema.minimum}`);
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        throw new ValidationError(`${context}: Value must be <= ${schema.maximum}`);
      }
    }

    if (typeof value === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        throw new ValidationError(`${context}: String must be at least ${schema.minLength} characters`);
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        throw new ValidationError(`${context}: String must be at most ${schema.maxLength} characters`);
      }
    }

    if (Array.isArray(value)) {
      if (schema.minItems !== undefined && value.length < schema.minItems) {
        throw new ValidationError(`${context}: Array must have at least ${schema.minItems} items`);
      }
      if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        throw new ValidationError(`${context}: Array must have at most ${schema.maxItems} items`);
      }
    }
  }

  /**
   * Validate object
   */
  async validateObject(value, schema, context) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new ValidationError(`${context}: Expected object`);
    }

    // Check required properties
    if (schema.required) {
      for (const requiredProp of schema.required) {
        if (!(requiredProp in value)) {
          throw new ValidationError(`${context}: Missing required property '${requiredProp}'`);
        }
      }
    }

    // Validate properties
    if (schema.properties) {
      for (const [propName, propValue] of Object.entries(value)) {
        const propSchema = schema.properties[propName];
        if (propSchema) {
          await this.validateValue(propValue, propSchema, `${context}.${propName}`);
        } else if (schema.additionalProperties === false) {
          throw new ValidationError(`${context}: Additional property '${propName}' not allowed`);
        }
      }
    }
  }

  /**
   * Validate array
   */
  async validateArray(value, schema, context) {
    if (!Array.isArray(value)) {
      throw new ValidationError(`${context}: Expected array`);
    }

    // Validate items
    if (schema.items) {
      for (let i = 0; i < value.length; i++) {
        await this.validateValue(value[i], schema.items, `${context}[${i}]`);
      }
    }
  }

  /**
   * Get validation statistics
   */
  getValidationStats() {
    return {
      ...this.validationStats,
      successRate: {
        requests: this.validationStats.totalRequests > 0 
          ? (this.validationStats.validRequests / this.validationStats.totalRequests * 100).toFixed(2) + '%'
          : '0%',
        responses: this.validationStats.totalResponses > 0
          ? (this.validationStats.validResponses / this.validationStats.totalResponses * 100).toFixed(2) + '%'
          : '0%'
      },
      recentErrors: this.validationStats.errors.slice(-10) // Last 10 errors
    };
  }

  /**
   * Reset validation statistics
   */
  resetStats() {
    this.validationStats = {
      totalRequests: 0,
      validRequests: 0,
      invalidRequests: 0,
      totalResponses: 0,
      validResponses: 0,
      invalidResponses: 0,
      errors: []
    };
  }

  /**
   * Generate validation report
   */
  generateValidationReport() {
    const stats = this.getValidationStats();
    
    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalEndpoints: this.validationRules.size,
        totalRequests: stats.totalRequests,
        totalResponses: stats.totalResponses,
        requestSuccessRate: stats.successRate.requests,
        responseSuccessRate: stats.successRate.responses
      },
      statistics: stats,
      endpoints: Array.from(this.validationRules.keys()),
      recommendations: this.generateRecommendations(stats)
    };
  }

  /**
   * Generate recommendations based on validation stats
   */
  generateRecommendations(stats) {
    const recommendations = [];

    if (stats.invalidRequests > stats.validRequests * 0.1) {
      recommendations.push({
        type: 'high_request_failure_rate',
        message: 'High request validation failure rate detected. Consider improving API documentation or client-side validation.',
        priority: 'high'
      });
    }

    if (stats.invalidResponses > stats.validResponses * 0.05) {
      recommendations.push({
        type: 'response_validation_issues',
        message: 'Response validation failures detected. Review API implementation for schema compliance.',
        priority: 'high'
      });
    }

    if (stats.errors.length > 100) {
      recommendations.push({
        type: 'high_error_volume',
        message: 'High volume of validation errors. Consider implementing better error handling and monitoring.',
        priority: 'medium'
      });
    }

    return recommendations;
  }
}

module.exports = RuntimeValidation;