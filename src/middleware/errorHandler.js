const { AppError } = require('../utils/errors');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Enhanced global error handler middleware
 */
class ErrorHandler {
  /**
   * Create the global error handling middleware
   */
  static createGlobalErrorHandler() {
    return (error, req, res, next) => {
      // Generate unique request ID for tracking
      const requestId = req.requestId || uuidv4();
      
      // Log the error using the logger
      const requestLogger = logger.withRequestId(requestId);
      requestLogger.error('Request error occurred', {
        error: error.message,
        stack: error.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        statusCode: error.statusCode || 500,
        errorCode: error.code,
        userId: req.user?.id
      });

      // Handle different types of errors
      let processedError = ErrorHandler.processError(error);
      
      // Add request ID to response
      processedError.requestId = requestId;
      
      // Send error response
      res.status(processedError.statusCode).json(processedError.toJSON());
    };
  }

  /**
   * Process different types of errors and convert them to AppError instances
   */
  static processError(error) {
    // If it's already an AppError, return as is
    if (error instanceof AppError) {
      return error;
    }

    // Handle specific error types
    if (error.name === 'ValidationError') {
      return new (require('../utils/errors').ValidationError)(
        error.message,
        error.details || error.errors
      );
    }

    if (error.name === 'JsonWebTokenError') {
      return new (require('../utils/errors').AuthenticationError)(
        'Invalid token',
        { originalError: error.message }
      );
    }

    if (error.name === 'TokenExpiredError') {
      return new (require('../utils/errors').AuthenticationError)(
        'Token expired',
        { originalError: error.message }
      );
    }

    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return new (require('../utils/errors').ConflictError)(
        'Resource already exists',
        { constraint: error.message }
      );
    }

    if (error.code && error.code.startsWith('SQLITE_')) {
      return new (require('../utils/errors').DatabaseError)(
        'Database operation failed',
        { 
          sqliteError: error.code,
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }
      );
    }

    if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
      return new (require('../utils/errors').ValidationError)(
        'Invalid JSON in request body',
        { originalError: error.message }
      );
    }

    // Handle payload too large errors
    if (error.type === 'entity.too.large') {
      return new (require('../utils/errors').ValidationError)(
        'Request payload too large',
        { limit: error.limit, length: error.length }
      );
    }

    // Default to internal server error
    return new (require('../utils/errors').InternalServerError)(
      process.env.NODE_ENV === 'production' 
        ? 'An internal server error occurred' 
        : error.message,
      process.env.NODE_ENV === 'development' 
        ? { originalError: error.message, stack: error.stack }
        : undefined
    );
  }

  /**
   * Create middleware to add request ID to all requests
   */
  static createRequestIdMiddleware() {
    return (req, res, next) => {
      req.requestId = uuidv4();
      res.setHeader('X-Request-ID', req.requestId);
      next();
    };
  }

  /**
   * Create async error wrapper for route handlers
   */
  static asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Create 404 handler middleware
   */
  static createNotFoundHandler() {
    return (req, res, next) => {
      const error = new (require('../utils/errors').NotFoundError)(
        `Route ${req.method} ${req.originalUrl} not found`
      );
      next(error);
    };
  }

  /**
   * Validation error handler for Joi validation
   */
  static handleValidationError(error, req, res, next) {
    if (error && error.isJoi) {
      const validationError = new (require('../utils/errors').ValidationError)(
        'Validation failed',
        {
          fields: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value
          }))
        }
      );
      return next(validationError);
    }
    next(error);
  }
}

module.exports = ErrorHandler;