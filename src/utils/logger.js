const winston = require('winston');
const path = require('path');

/**
 * Logger configuration and setup
 */
class Logger {
  constructor() {
    this.logger = null;
    this.init();
  }

  /**
   * Initialize the logger with appropriate configuration
   */
  init() {
    const logLevel = process.env.LOG_LEVEL || 'info';
    const nodeEnv = process.env.NODE_ENV || 'development';
    
    // Define log format
    const logFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.prettyPrint()
    );

    // Console format for development
    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let log = `${timestamp} [${level}]: ${message}`;
        
        // Add stack trace for errors
        if (stack) {
          log += `\n${stack}`;
        }
        
        // Add metadata if present
        if (Object.keys(meta).length > 0) {
          log += `\n${JSON.stringify(meta, null, 2)}`;
        }
        
        return log;
      })
    );

    // Create transports array
    const transports = [];

    // Console transport (always enabled)
    transports.push(
      new winston.transports.Console({
        level: logLevel,
        format: nodeEnv === 'production' ? logFormat : consoleFormat,
        handleExceptions: true,
        handleRejections: true
      })
    );

    // File transports for production
    if (nodeEnv === 'production') {
      // Ensure logs directory exists
      const logsDir = path.join(process.cwd(), 'logs');
      
      // Combined log file
      transports.push(
        new winston.transports.File({
          filename: path.join(logsDir, 'combined.log'),
          level: 'info',
          format: logFormat,
          maxsize: 5242880, // 5MB
          maxFiles: 5,
          handleExceptions: true,
          handleRejections: true
        })
      );

      // Error log file
      transports.push(
        new winston.transports.File({
          filename: path.join(logsDir, 'error.log'),
          level: 'error',
          format: logFormat,
          maxsize: 5242880, // 5MB
          maxFiles: 5,
          handleExceptions: true,
          handleRejections: true
        })
      );
    }

    // Create the logger
    this.logger = winston.createLogger({
      level: logLevel,
      format: logFormat,
      transports,
      exitOnError: false
    });

    // Handle uncaught exceptions and unhandled rejections
    this.logger.exceptions.handle(
      new winston.transports.Console({
        format: consoleFormat
      })
    );

    this.logger.rejections.handle(
      new winston.transports.Console({
        format: consoleFormat
      })
    );
  }

  /**
   * Log an error message
   */
  error(message, meta = {}) {
    this.logger.error(message, meta);
  }

  /**
   * Log a warning message
   */
  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  /**
   * Log an info message
   */
  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  /**
   * Log a debug message
   */
  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  /**
   * Log HTTP request information
   */
  http(message, meta = {}) {
    this.logger.http(message, meta);
  }

  /**
   * Log verbose information
   */
  verbose(message, meta = {}) {
    this.logger.verbose(message, meta);
  }

  /**
   * Log silly level information
   */
  silly(message, meta = {}) {
    this.logger.silly(message, meta);
  }

  /**
   * Create a child logger with additional context
   */
  child(meta = {}) {
    return this.logger.child(meta);
  }

  /**
   * Get the underlying Winston logger instance
   */
  getLogger() {
    return this.logger;
  }

  /**
   * Create request-specific logger with request ID
   */
  withRequestId(requestId) {
    return this.child({ requestId });
  }

  /**
   * Create user-specific logger with user ID
   */
  withUserId(userId) {
    return this.child({ userId });
  }

  /**
   * Log database operations
   */
  database(operation, meta = {}) {
    this.debug(`Database ${operation}`, {
      category: 'database',
      operation,
      ...meta
    });
  }

  /**
   * Log authentication events
   */
  auth(event, meta = {}) {
    this.info(`Auth ${event}`, {
      category: 'authentication',
      event,
      ...meta
    });
  }

  /**
   * Log API requests
   */
  api(method, path, statusCode, responseTime, meta = {}) {
    const level = statusCode >= 400 ? 'warn' : 'info';
    this.logger.log(level, `${method} ${path} ${statusCode} - ${responseTime}ms`, {
      category: 'api',
      method,
      path,
      statusCode,
      responseTime,
      ...meta
    });
  }

  /**
   * Log security events
   */
  security(event, meta = {}) {
    this.warn(`Security ${event}`, {
      category: 'security',
      event,
      ...meta
    });
  }

  /**
   * Log performance metrics
   */
  performance(metric, value, meta = {}) {
    this.info(`Performance ${metric}: ${value}`, {
      category: 'performance',
      metric,
      value,
      ...meta
    });
  }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger;