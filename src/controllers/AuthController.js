const AuthService = require('../services/AuthService');
const jwtUtils = require('../utils/jwt');

/**
 * Authentication controller for handling auth-related HTTP requests
 */
class AuthController {
  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Initialize controller with database connection
   */
  init() {
    this.authService.init();
    return this;
  }

  /**
   * Register a new user
   * POST /api/auth/register
   */
  register = async (req, res) => {
    try {
      const result = await this.authService.register(req.body);
      
      res.status(201).json({
        success: true,
        message: result.message,
        data: {
          user: result.user,
          tokens: result.tokens
        }
      });
    } catch (error) {
      let statusCode = 400;
      let errorCode = 'REGISTRATION_FAILED';

      if (error.message.includes('Email already exists')) {
        statusCode = 409;
        errorCode = 'EMAIL_EXISTS';
      } else if (error.message.includes('Validation failed')) {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
      }

      res.status(statusCode).json({
        success: false,
        error: {
          code: errorCode,
          message: error.message.replace('Registration failed: ', '')
        }
      });
    }
  };

  /**
   * Login user
   * POST /api/auth/login
   */
  login = async (req, res) => {
    try {
      const result = await this.authService.login(req.body);
      
      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          user: result.user,
          tokens: result.tokens
        }
      });
    } catch (error) {
      let statusCode = 401;
      let errorCode = 'LOGIN_FAILED';

      if (error.message.includes('Invalid email or password')) {
        statusCode = 401;
        errorCode = 'INVALID_CREDENTIALS';
      } else if (error.message.includes('Account is deactivated')) {
        statusCode = 403;
        errorCode = 'ACCOUNT_DEACTIVATED';
      } else if (error.message.includes('Validation failed')) {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
      }

      res.status(statusCode).json({
        success: false,
        error: {
          code: errorCode,
          message: error.message.replace('Login failed: ', '')
        }
      });
    }
  };

  /**
   * Refresh access token
   * POST /api/auth/refresh
   */
  refresh = async (req, res) => {
    try {
      const { refreshToken } = req.body;
      const result = await this.authService.refreshToken(refreshToken);
      
      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          tokens: result.tokens
        }
      });
    } catch (error) {
      let statusCode = 401;
      let errorCode = 'TOKEN_REFRESH_FAILED';

      if (error.message.includes('expired')) {
        statusCode = 401;
        errorCode = 'REFRESH_TOKEN_EXPIRED';
      } else if (error.message.includes('invalid') || error.message.includes('Invalid token type')) {
        statusCode = 401;
        errorCode = 'INVALID_REFRESH_TOKEN';
      } else if (error.message.includes('User not found')) {
        statusCode = 401;
        errorCode = 'USER_NOT_FOUND';
      } else if (error.message.includes('Account is deactivated')) {
        statusCode = 403;
        errorCode = 'ACCOUNT_DEACTIVATED';
      }

      res.status(statusCode).json({
        success: false,
        error: {
          code: errorCode,
          message: error.message.replace('Token refresh failed: ', '')
        }
      });
    }
  };

  /**
   * Logout user
   * POST /api/auth/logout
   */
  logout = async (req, res) => {
    try {
      const userId = req.user ? req.user.id : null;
      const result = await this.authService.logout(userId);
      
      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'LOGOUT_FAILED',
          message: error.message.replace('Logout failed: ', '')
        }
      });
    }
  };

  /**
   * Get current user profile
   * GET /api/auth/me
   */
  me = async (req, res) => {
    try {
      const result = await this.authService.getUserProfile(req.user.id);
      
      res.status(200).json({
        success: true,
        data: {
          user: result.user
        }
      });
    } catch (error) {
      let statusCode = 404;
      let errorCode = 'USER_NOT_FOUND';

      res.status(statusCode).json({
        success: false,
        error: {
          code: errorCode,
          message: error.message.replace('Failed to get user profile: ', '')
        }
      });
    }
  };

  /**
   * Change user password
   * POST /api/auth/change-password
   */
  changePassword = async (req, res) => {
    try {
      const result = await this.authService.changePassword(req.user.id, req.body);
      
      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      let statusCode = 400;
      let errorCode = 'PASSWORD_CHANGE_FAILED';

      if (error.message.includes('Current password is incorrect')) {
        statusCode = 401;
        errorCode = 'INCORRECT_CURRENT_PASSWORD';
      } else if (error.message.includes('Validation failed')) {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
      } else if (error.message.includes('User not found')) {
        statusCode = 404;
        errorCode = 'USER_NOT_FOUND';
      }

      res.status(statusCode).json({
        success: false,
        error: {
          code: errorCode,
          message: error.message.replace('Password change failed: ', '')
        }
      });
    }
  };

  /**
   * Request password reset
   * POST /api/auth/forgot-password
   */
  forgotPassword = async (req, res) => {
    try {
      const { email } = req.body;
      const result = await this.authService.requestPasswordReset(email);
      
      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'PASSWORD_RESET_FAILED',
          message: error.message.replace('Password reset request failed: ', '')
        }
      });
    }
  };

  /**
   * Verify authentication token
   * GET /api/auth/verify
   */
  verify = async (req, res) => {
    try {
      // If we reach here, the auth middleware has already verified the token
      res.status(200).json({
        success: true,
        message: 'Token is valid',
        data: {
          user: req.user,
          tokenData: {
            userId: req.tokenData.userId,
            email: req.tokenData.email,
            iat: req.tokenData.iat,
            exp: req.tokenData.exp
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'VERIFICATION_FAILED',
          message: 'Failed to verify token'
        }
      });
    }
  };

  /**
   * Health check endpoint
   * GET /api/auth/health
   */
  health = (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Authentication service is healthy',
      timestamp: new Date().toISOString()
    });
  };
}

module.exports = AuthController;