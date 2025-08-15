const path = require('path');
const logger = require('../utils/logger');

/**
 * Environment configuration management
 * Validates and provides typed access to environment variables
 */
class EnvironmentConfig {
  constructor() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  /**
   * Load configuration from environment variables with defaults
   */
  loadConfiguration() {
    return {
      // Server Configuration
      server: {
        port: parseInt(process.env.PORT) || 3000,
        host: process.env.HOST || '0.0.0.0',
        environment: process.env.NODE_ENV || 'development'
      },

      // Database Configuration
      database: {
        path: process.env.DATABASE_PATH || path.join(process.cwd(), 'database', 'notes.db'),
        enableWAL: process.env.DATABASE_ENABLE_WAL !== 'false',
        timeout: parseInt(process.env.DATABASE_TIMEOUT) || 5000,
        verbose: process.env.DATABASE_VERBOSE === 'true'
      },

      // JWT Configuration
      jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN || '15m',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        issuer: process.env.JWT_ISSUER || 'note-management-app',
        audience: process.env.JWT_AUDIENCE || 'note-management-users'
      },

      // Email Configuration
      email: {
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        user: process.env.EMAIL_USER,
        password: process.env.EMAIL_PASS,
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER
      },

      // Rate Limiting Configuration
      rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
        authWindowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
        authMaxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 5
      },

      // Logging Configuration
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        enableConsole: process.env.LOG_ENABLE_CONSOLE !== 'false',
        enableFile: process.env.LOG_ENABLE_FILE === 'true',
        filePath: process.env.LOG_FILE_PATH || path.join(process.cwd(), 'logs', 'app.log'),
        maxSize: process.env.LOG_MAX_SIZE || '10m',
        maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5
      },

      // Security Configuration
      security: {
        enableCors: process.env.SECURITY_ENABLE_CORS !== 'false',
        corsOrigin: process.env.CORS_ORIGIN || '*',
        enableHelmet: process.env.SECURITY_ENABLE_HELMET !== 'false',
        enableRateLimit: process.env.SECURITY_ENABLE_RATE_LIMIT !== 'false',
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12
      },

      // Application Configuration
      app: {
        name: process.env.APP_NAME || 'Note Management App',
        version: process.env.APP_VERSION || '1.0.0',
        baseUrl: process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173'
      }
    };
  }

  /**
   * Validate required configuration values
   */
  validateConfiguration() {
    const errors = [];

    // Validate JWT secret in production
    if (this.config.server.environment === 'production' && !this.config.jwt.secret) {
      errors.push('JWT_SECRET is required in production environment');
    }

    // Validate JWT secret strength
    if (this.config.jwt.secret && this.config.jwt.secret.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters long');
    }

    // Validate email configuration if email features are used
    if (this.config.server.environment === 'production') {
      if (!this.config.email.host || !this.config.email.user || !this.config.email.password) {
        logger.warn('Email configuration incomplete - password reset functionality will be disabled');
      }
    }

    // Validate port range
    if (this.config.server.port < 1 || this.config.server.port > 65535) {
      errors.push('PORT must be between 1 and 65535');
    }

    // Validate database path
    if (!this.config.database.path) {
      errors.push('DATABASE_PATH is required');
    }

    if (errors.length > 0) {
      const errorMessage = `Configuration validation failed:\n${errors.join('\n')}`;
      logger.error('Environment configuration validation failed', { errors });
      throw new Error(errorMessage);
    }

    logger.info('Environment configuration validated successfully', {
      environment: this.config.server.environment,
      port: this.config.server.port,
      database: this.config.database.path,
      logLevel: this.config.logging.level
    });
  }

  /**
   * Get configuration value by path (e.g., 'server.port')
   */
  get(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this.config);
  }

  /**
   * Get all configuration
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * Check if running in development mode
   */
  isDevelopment() {
    return this.config.server.environment === 'development';
  }

  /**
   * Check if running in production mode
   */
  isProduction() {
    return this.config.server.environment === 'production';
  }

  /**
   * Check if running in test mode
   */
  isTest() {
    return this.config.server.environment === 'test';
  }

  /**
   * Get sanitized configuration for logging (removes sensitive data)
   */
  getSanitizedConfig() {
    const sanitized = JSON.parse(JSON.stringify(this.config));
    
    // Remove sensitive information
    if (sanitized.jwt.secret) {
      sanitized.jwt.secret = '***REDACTED***';
    }
    if (sanitized.email.password) {
      sanitized.email.password = '***REDACTED***';
    }
    
    return sanitized;
  }
}

// Create singleton instance
const environmentConfig = new EnvironmentConfig();

module.exports = environmentConfig;