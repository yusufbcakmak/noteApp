const jwtUtils = require('../utils/jwt');
const AuthService = require('../services/AuthService');

/**
 * Authentication middleware for protecting routes
 */
class AuthMiddleware {
  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Initialize middleware with database connection
   */
  init() {
    this.authService.init();
    return this;
  }

  /**
   * Middleware to authenticate requests using JWT tokens
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  authenticate = async (req, res, next) => {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      const token = jwtUtils.extractTokenFromHeader(authHeader);

      if (!token) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'MISSING_TOKEN',
            message: 'Access token is required'
          }
        });
      }

      // Verify authentication
      const authResult = await this.authService.verifyAuth(token);

      // Add user data to request object
      req.user = authResult.user;
      req.tokenData = authResult.tokenData;

      next();
    } catch (error) {
      let statusCode = 401;
      let errorCode = 'AUTHENTICATION_FAILED';

      if (error.message.includes('expired')) {
        errorCode = 'TOKEN_EXPIRED';
      } else if (error.message.includes('invalid')) {
        errorCode = 'INVALID_TOKEN';
      } else if (error.message.includes('deactivated')) {
        errorCode = 'ACCOUNT_DEACTIVATED';
        statusCode = 403;
      }

      return res.status(statusCode).json({
        success: false,
        error: {
          code: errorCode,
          message: error.message.replace('Authentication verification failed: ', '')
        }
      });
    }
  };

  /**
   * Middleware to check if user is active
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  requireActiveUser = (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        }
      });
    }

    if (!req.user.isActive) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_DEACTIVATED',
          message: 'Account is deactivated'
        }
      });
    }

    next();
  };

  /**
   * Middleware to extract user ID from token (optional authentication)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  optionalAuth = async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      const token = jwtUtils.extractTokenFromHeader(authHeader);

      if (token) {
        const authResult = await this.authService.verifyAuth(token);
        req.user = authResult.user;
        req.tokenData = authResult.tokenData;
      }

      next();
    } catch (error) {
      // For optional auth, we don't return errors, just continue without user data
      next();
    }
  };

  /**
   * Middleware to validate user ownership of resources
   * @param {string} userIdParam - Parameter name containing user ID (default: 'userId')
   * @returns {Function} - Express middleware function
   */
  requireOwnership = (userIdParam = 'userId') => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required'
          }
        });
      }

      const resourceUserId = req.params[userIdParam] || req.body[userIdParam];
      
      if (!resourceUserId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_USER_ID',
            message: `${userIdParam} is required`
          }
        });
      }

      if (req.user.id !== resourceUserId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'You can only access your own resources'
          }
        });
      }

      next();
    };
  };

  /**
   * Rate limiting middleware for authentication endpoints
   * @param {number} maxAttempts - Maximum attempts per window
   * @param {number} windowMs - Time window in milliseconds
   * @returns {Function} - Express middleware function
   */
  rateLimitAuth = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
    const attempts = new Map();

    return (req, res, next) => {
      // Skip rate limiting in test environment
      if (process.env.NODE_ENV === 'test') {
        return next();
      }
      const clientId = req.ip || req.connection.remoteAddress;
      const now = Date.now();
      
      // Clean up old entries
      for (const [key, data] of attempts.entries()) {
        if (now - data.firstAttempt > windowMs) {
          attempts.delete(key);
        }
      }

      // Get or create attempt data for this client
      let attemptData = attempts.get(clientId);
      if (!attemptData) {
        attemptData = {
          count: 0,
          firstAttempt: now
        };
        attempts.set(clientId, attemptData);
      }

      // Check if within time window
      if (now - attemptData.firstAttempt > windowMs) {
        // Reset counter for new window
        attemptData.count = 0;
        attemptData.firstAttempt = now;
      }

      // Check rate limit
      if (attemptData.count >= maxAttempts) {
        const resetTime = new Date(attemptData.firstAttempt + windowMs);
        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many authentication attempts. Please try again later.',
            retryAfter: resetTime.toISOString()
          }
        });
      }

      // Increment attempt counter
      attemptData.count++;

      next();
    };
  };

  /**
   * Middleware to log authentication events
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  logAuthEvent = (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log authentication events
      const logData = {
        timestamp: new Date().toISOString(),
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        userId: req.user ? req.user.id : null
      };

      // Only log authentication-related endpoints
      if (req.path.startsWith('/api/auth/')) {
        console.log('Auth Event:', JSON.stringify(logData));
      }

      originalSend.call(this, data);
    };

    next();
  };
}

// Create singleton instance
const authMiddleware = new AuthMiddleware();

module.exports = authMiddleware;