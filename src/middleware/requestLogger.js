const logger = require('../utils/logger');

/**
 * Request logging middleware
 */
class RequestLogger {
  /**
   * Create request logging middleware
   */
  static createRequestLogger(options = {}) {
    const {
      logLevel = 'info',
      logBody = false,
      logHeaders = false,
      skipPaths = ['/health', '/favicon.ico'],
      skipSuccessfulGET = false
    } = options;

    return (req, res, next) => {
      // Skip logging for certain paths
      if (skipPaths.includes(req.path)) {
        return next();
      }

      const startTime = Date.now();
      const requestId = req.requestId || 'unknown';
      const requestLogger = logger.withRequestId(requestId);

      // Log request start
      const requestMeta = {
        method: req.method,
        url: req.originalUrl,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        contentType: req.get('Content-Type'),
        contentLength: req.get('Content-Length')
      };

      // Add headers if requested
      if (logHeaders) {
        requestMeta.headers = req.headers;
      }

      // Add body if requested (be careful with sensitive data)
      if (logBody && req.body && Object.keys(req.body).length > 0) {
        // Filter out sensitive fields
        const filteredBody = RequestLogger.filterSensitiveData(req.body);
        requestMeta.body = filteredBody;
      }

      // Add query parameters
      if (req.query && Object.keys(req.query).length > 0) {
        requestMeta.query = req.query;
      }

      // Add user ID if available
      if (req.user && req.user.id) {
        requestMeta.userId = req.user.id;
      }

      requestLogger.http('Request started', requestMeta);

      // Override res.end to log response
      const originalEnd = res.end;
      res.end = function(chunk, encoding) {
        const responseTime = Date.now() - startTime;
        const statusCode = res.statusCode;

        // Determine log level based on status code
        let level = 'info';
        if (statusCode >= 500) {
          level = 'error';
        } else if (statusCode >= 400) {
          level = 'warn';
        } else if (skipSuccessfulGET && req.method === 'GET' && statusCode < 300) {
          level = 'debug';
        }

        const responseMeta = {
          method: req.method,
          url: req.originalUrl,
          statusCode,
          responseTime,
          contentLength: res.get('Content-Length'),
          contentType: res.get('Content-Type')
        };

        // Add user ID if available
        if (req.user && req.user.id) {
          responseMeta.userId = req.user.id;
        }

        requestLogger[level]('Request completed', responseMeta);

        // Call original end method
        originalEnd.call(this, chunk, encoding);
      };

      next();
    };
  }

  /**
   * Filter sensitive data from request body
   */
  static filterSensitiveData(data) {
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'authorization',
      'auth',
      'credential',
      'pass'
    ];

    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const filtered = { ...data };

    for (const field of sensitiveFields) {
      for (const key in filtered) {
        if (key.toLowerCase().includes(field.toLowerCase())) {
          filtered[key] = '[FILTERED]';
        }
      }
    }

    return filtered;
  }

  /**
   * Create error logging middleware
   */
  static createErrorLogger() {
    return (error, req, res, next) => {
      const requestId = req.requestId || 'unknown';
      const requestLogger = logger.withRequestId(requestId);

      const errorMeta = {
        method: req.method,
        url: req.originalUrl,
        statusCode: error.statusCode || 500,
        errorCode: error.code,
        stack: error.stack,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      };

      // Add user ID if available
      if (req.user && req.user.id) {
        errorMeta.userId = req.user.id;
      }

      requestLogger.error(`Request error: ${error.message}`, errorMeta);

      next(error);
    };
  }

  /**
   * Create slow request logger
   */
  static createSlowRequestLogger(threshold = 1000) {
    return (req, res, next) => {
      const startTime = Date.now();
      const requestId = req.requestId || 'unknown';

      // Override res.end to check response time
      const originalEnd = res.end;
      res.end = function(chunk, encoding) {
        const responseTime = Date.now() - startTime;

        if (responseTime > threshold) {
          const requestLogger = logger.withRequestId(requestId);
          requestLogger.warn('Slow request detected', {
            method: req.method,
            url: req.originalUrl,
            responseTime,
            threshold,
            statusCode: res.statusCode
          });
        }

        originalEnd.call(this, chunk, encoding);
      };

      next();
    };
  }

  /**
   * Create security event logger
   */
  static createSecurityLogger() {
    return (req, res, next) => {
      const requestId = req.requestId || 'unknown';
      const requestLogger = logger.withRequestId(requestId);

      // Log potential security events
      const userAgent = req.get('User-Agent') || '';
      const ip = req.ip;

      // Check for suspicious patterns
      if (this.isSuspiciousRequest(req)) {
        requestLogger.security('Suspicious request detected', {
          method: req.method,
          url: req.originalUrl,
          ip,
          userAgent,
          reason: 'Suspicious patterns detected'
        });
      }

      // Log failed authentication attempts
      res.on('finish', () => {
        if (req.path.includes('/auth/') && res.statusCode === 401) {
          requestLogger.security('Failed authentication attempt', {
            method: req.method,
            url: req.originalUrl,
            ip,
            userAgent
          });
        }
      });

      next();
    };
  }

  /**
   * Check if request is suspicious
   */
  static isSuspiciousRequest(req) {
    const suspiciousPatterns = [
      /\.\./,  // Path traversal
      /<script/i,  // XSS attempts
      /union.*select/i,  // SQL injection
      /exec\(/i,  // Code injection
      /eval\(/i   // Code injection
    ];

    const checkString = `${req.originalUrl} ${JSON.stringify(req.query)} ${JSON.stringify(req.body)}`;
    
    return suspiciousPatterns.some(pattern => pattern.test(checkString));
  }
}

module.exports = RequestLogger;