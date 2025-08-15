const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');

/**
 * Security middleware configuration
 */
class SecurityMiddleware {
  /**
   * Create rate limiting middleware for authentication endpoints
   * @param {Object} options - Rate limiting options
   * @returns {Function} Express middleware function
   */
  static createAuthRateLimit(options = {}) {
    const defaultOptions = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // Limit each IP to 5 requests per windowMs for auth endpoints
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many authentication attempts, please try again later'
        },
        timestamp: new Date().toISOString()
      },
      standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
      legacyHeaders: false, // Disable the `X-RateLimit-*` headers
      handler: (req, res) => {
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many authentication attempts, please try again later',
            retryAfter: Math.round(options.windowMs / 1000) || 900 // seconds
          },
          timestamp: new Date().toISOString()
        });
      },
      skip: (req) => {
        // Skip rate limiting in test environment
        return process.env.NODE_ENV === 'test';
      }
    };

    return rateLimit({ ...defaultOptions, ...options });
  }

  /**
   * Create rate limiting middleware for general API endpoints
   * @param {Object} options - Rate limiting options
   * @returns {Function} Express middleware function
   */
  static createGeneralRateLimit(options = {}) {
    const defaultOptions = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs for general endpoints
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later'
        },
        timestamp: new Date().toISOString()
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later',
            retryAfter: Math.round(options.windowMs / 1000) || 900 // seconds
          },
          timestamp: new Date().toISOString()
        });
      },
      skip: (req) => {
        // Skip rate limiting in test environment
        return process.env.NODE_ENV === 'test';
      }
    };

    return rateLimit({ ...defaultOptions, ...options });
  }

  /**
   * Create CORS middleware with secure configuration
   * @param {Object} options - CORS options
   * @returns {Function} Express middleware function
   */
  static createCorsMiddleware(options = {}) {
    const defaultOptions = {
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // In development, allow all origins
        if (process.env.NODE_ENV === 'development') {
          return callback(null, true);
        }

        // In production, check against allowed origins
        const allowedOrigins = process.env.ALLOWED_ORIGINS 
          ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
          : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true, // Allow cookies to be sent
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'Cache-Control',
        'Pragma'
      ],
      exposedHeaders: [
        'RateLimit-Limit',
        'RateLimit-Remaining',
        'RateLimit-Reset'
      ],
      maxAge: 86400 // 24 hours
    };

    return cors({ ...defaultOptions, ...options });
  }

  /**
   * Create Helmet middleware with secure configuration
   * @param {Object} options - Helmet options
   * @returns {Function} Express middleware function
   */
  static createHelmetMiddleware(options = {}) {
    const defaultOptions = {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      crossOriginEmbedderPolicy: false, // Disable for API compatibility
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      },
      noSniff: true,
      frameguard: { action: 'deny' },
      xssFilter: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    };

    // In development, relax some security policies
    if (process.env.NODE_ENV === 'development') {
      defaultOptions.contentSecurityPolicy = false;
      defaultOptions.hsts = false;
    }

    return helmet({ ...defaultOptions, ...options });
  }

  /**
   * Create request size limiting middleware
   * @param {Object} options - Size limit options
   * @returns {Object} Express middleware configuration
   */
  static createSizeLimitMiddleware(options = {}) {
    const defaultOptions = {
      json: { limit: '10mb' },
      urlencoded: { extended: true, limit: '10mb' }
    };

    return { ...defaultOptions, ...options };
  }

  /**
   * Create security headers middleware
   * @returns {Function} Express middleware function
   */
  static createSecurityHeaders() {
    return (req, res, next) => {
      // Remove server information
      res.removeHeader('X-Powered-By');
      
      // Add custom security headers
      res.setHeader('X-API-Version', '1.0.0');
      res.setHeader('X-Request-ID', req.id || 'unknown');
      
      // Prevent caching of sensitive endpoints
      if (req.path.includes('/auth/') || req.path.includes('/user/')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }

      next();
    };
  }

  /**
   * Create request ID middleware
   * @returns {Function} Express middleware function
   */
  static createRequestIdMiddleware() {
    return (req, res, next) => {
      // Generate a unique request ID
      req.id = req.headers['x-request-id'] || 
               `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Add request ID to response headers
      res.setHeader('X-Request-ID', req.id);
      
      next();
    };
  }

  /**
   * Create comprehensive security middleware stack
   * @param {Object} options - Configuration options
   * @returns {Array} Array of middleware functions
   */
  static createSecurityStack(options = {}) {
    const {
      enableRateLimit = true,
      enableCors = true,
      enableHelmet = true,
      authRateLimitOptions = {},
      generalRateLimitOptions = {},
      corsOptions = {},
      helmetOptions = {}
    } = options;

    const middlewares = [];

    // Request ID middleware (should be first)
    middlewares.push(SecurityMiddleware.createRequestIdMiddleware());

    // Helmet security headers
    if (enableHelmet) {
      middlewares.push(SecurityMiddleware.createHelmetMiddleware(helmetOptions));
    }

    // CORS middleware
    if (enableCors) {
      middlewares.push(SecurityMiddleware.createCorsMiddleware(corsOptions));
    }

    // Custom security headers
    middlewares.push(SecurityMiddleware.createSecurityHeaders());

    // Rate limiting (if enabled)
    if (enableRateLimit) {
      // Note: Specific rate limits should be applied to specific routes
      // This is just the general rate limit
      middlewares.push(SecurityMiddleware.createGeneralRateLimit(generalRateLimitOptions));
    }

    return middlewares;
  }
}

module.exports = SecurityMiddleware;