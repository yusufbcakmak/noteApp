/**
 * Custom error classes for the application
 */

class AppError extends Error {
  constructor(message, statusCode, code = null, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code || this.constructor.name.toUpperCase();
    this.details = details;
    this.isOperational = true;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details
      },
      timestamp: this.timestamp,
      requestId: this.requestId // Will be set by error handler
    };
  }

  /**
   * Set request ID for error tracking
   */
  setRequestId(requestId) {
    this.requestId = requestId;
    return this;
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed', details = null) {
    super(message, 401, 'AUTHENTICATION_ERROR', details);
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied', details = null) {
    super(message, 403, 'AUTHORIZATION_ERROR', details);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details = null) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details = null) {
    super(message, 409, 'CONFLICT_ERROR', details);
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests', details = null) {
    super(message, 429, 'RATE_LIMIT_ERROR', details);
  }
}

class InternalServerError extends AppError {
  constructor(message = 'Internal server error', details = null) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', details);
  }
}

class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', details = null) {
    super(message, 500, 'DATABASE_ERROR', details);
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Bad request', details = null) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable', details = null) {
    super(message, 503, 'SERVICE_UNAVAILABLE', details);
  }
}

class TimeoutError extends AppError {
  constructor(message = 'Request timeout', details = null) {
    super(message, 408, 'TIMEOUT_ERROR', details);
  }
}

/**
 * HTTP Status Code constants
 */
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
};

/**
 * Error factory for creating specific error types
 */
class ErrorFactory {
  static validation(message, details = null) {
    return new ValidationError(message, details);
  }

  static authentication(message = 'Authentication failed', details = null) {
    return new AuthenticationError(message, details);
  }

  static authorization(message = 'Access denied', details = null) {
    return new AuthorizationError(message, details);
  }

  static notFound(resource = 'Resource', details = null) {
    return new NotFoundError(`${resource} not found`, details);
  }

  static conflict(message = 'Resource conflict', details = null) {
    return new ConflictError(message, details);
  }

  static rateLimit(message = 'Too many requests', details = null) {
    return new RateLimitError(message, details);
  }

  static internal(message = 'Internal server error', details = null) {
    return new InternalServerError(message, details);
  }

  static database(message = 'Database operation failed', details = null) {
    return new DatabaseError(message, details);
  }

  static badRequest(message = 'Bad request', details = null) {
    return new BadRequestError(message, details);
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  InternalServerError,
  DatabaseError,
  BadRequestError,
  ServiceUnavailableError,
  TimeoutError,
  HTTP_STATUS,
  ErrorFactory
};