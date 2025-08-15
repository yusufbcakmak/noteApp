const Joi = require('joi');

/**
 * Validation middleware factory
 */
class ValidationMiddleware {
  /**
   * Create validation middleware for request body
   * @param {Joi.Schema} schema - Joi validation schema
   * @param {Object} options - Validation options
   * @returns {Function} Express middleware function
   */
  static validateBody(schema, options = {}) {
    return (req, res, next) => {
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
        ...options
      });

      if (error) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: error.details.map(detail => ({
              field: detail.path.join('.'),
              message: detail.message,
              value: detail.context?.value
            }))
          },
          timestamp: new Date().toISOString()
        });
      }

      // Sanitize string fields
      Object.assign(req.body, ValidationMiddleware._sanitizeObject(value));
      next();
    };
  }

  /**
   * Create validation middleware for query parameters
   * @param {Joi.Schema} schema - Joi validation schema
   * @param {Object} options - Validation options
   * @returns {Function} Express middleware function
   */
  static validateQuery(schema, options = {}) {
    return (req, res, next) => {
      const { error, value } = schema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true,
        ...options
      });

      if (error) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Query validation failed',
            details: error.details.map(detail => ({
              field: detail.path.join('.'),
              message: detail.message,
              value: detail.context?.value
            }))
          },
          timestamp: new Date().toISOString()
        });
      }

      // Sanitize string fields
      Object.assign(req.query, ValidationMiddleware._sanitizeObject(value));
      next();
    };
  }

  /**
   * Create validation middleware for URL parameters
   * @param {Joi.Schema} schema - Joi validation schema
   * @param {Object} options - Validation options
   * @returns {Function} Express middleware function
   */
  static validateParams(schema, options = {}) {
    return (req, res, next) => {
      const { error, value } = schema.validate(req.params, {
        abortEarly: false,
        stripUnknown: true,
        ...options
      });

      if (error) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Parameter validation failed',
            details: error.details.map(detail => ({
              field: detail.path.join('.'),
              message: detail.message,
              value: detail.context?.value
            }))
          },
          timestamp: new Date().toISOString()
        });
      }

      Object.assign(req.params, value);
      next();
    };
  }

  /**
   * Sanitize object by cleaning string values
   * @param {Object} obj - Object to sanitize
   * @returns {Object} Sanitized object
   */
  static _sanitizeObject(obj) {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return ValidationMiddleware._sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => ValidationMiddleware._sanitizeObject(item));
    }

    if (typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = ValidationMiddleware._sanitizeObject(value);
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Sanitize string input
   * @param {string} str - String to sanitize
   * @returns {string} Sanitized string
   */
  static _sanitizeString(str) {
    if (typeof str !== 'string') {
      return str;
    }

    // Basic HTML sanitization (remove potential XSS)
    let sanitized = str;
    
    // Remove HTML tags and decode entities
    sanitized = sanitized.replace(/<[^>]*>/g, '');
    
    // Remove potentially dangerous characters
    sanitized = sanitized.replace(/[<>'"&]/g, (match) => {
      const entities = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;'
      };
      return entities[match] || match;
    });

    // Trim whitespace
    sanitized = sanitized.trim();

    return sanitized;
  }

  /**
   * Create combined validation middleware
   * @param {Object} schemas - Object containing body, query, and params schemas
   * @param {Object} options - Validation options
   * @returns {Function} Express middleware function
   */
  static validate(schemas = {}, options = {}) {
    return (req, res, next) => {
      const errors = [];

      // Validate body
      if (schemas.body) {
        const { error, value } = schemas.body.validate(req.body, {
          abortEarly: false,
          stripUnknown: true,
          ...options
        });

        if (error) {
          errors.push(...error.details.map(detail => ({
            type: 'body',
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value
          })));
        } else {
          Object.assign(req.body, ValidationMiddleware._sanitizeObject(value));
        }
      }

      // Validate query
      if (schemas.query) {
        const { error, value } = schemas.query.validate(req.query, {
          abortEarly: false,
          stripUnknown: true,
          ...options
        });

        if (error) {
          errors.push(...error.details.map(detail => ({
            type: 'query',
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value
          })));
        } else {
          Object.assign(req.query, ValidationMiddleware._sanitizeObject(value));
        }
      }

      // Validate params
      if (schemas.params) {
        const { error, value } = schemas.params.validate(req.params, {
          abortEarly: false,
          stripUnknown: true,
          ...options
        });

        if (error) {
          errors.push(...error.details.map(detail => ({
            type: 'params',
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value
          })));
        } else {
          Object.assign(req.params, value);
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: errors
          },
          timestamp: new Date().toISOString()
        });
      }

      next();
    };
  }
}

module.exports = ValidationMiddleware;