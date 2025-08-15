#!/usr/bin/env node

/**
 * Application startup script
 * Handles environment setup, graceful shutdown, and error handling
 */

const { app, initializeRoutes } = require('./app');
const config = require('./config/environment');
const logger = require('./utils/logger');
const dbConnection = require('./config/database');

/**
 * Application startup class
 */
class ApplicationServer {
  constructor() {
    this.server = null;
    this.isShuttingDown = false;
    this.shutdownTimeout = 10000; // 10 seconds
  }

  /**
   * Start the application server
   */
  async start() {
    try {
      // Log startup information
      logger.info('Starting Note Management Application', {
        version: config.get('app.version'),
        environment: config.get('server.environment'),
        port: config.get('server.port'),
        host: config.get('server.host'),
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid
      });

      // Validate environment configuration
      this.validateEnvironment();

      // Initialize database connection
      await this.initializeDatabase();

      // Initialize API routes after database is ready
      initializeRoutes();

      // Start HTTP server
      await this.startHttpServer();

      // Setup signal handlers for graceful shutdown
      this.setupSignalHandlers();

      // Setup process error handlers
      this.setupErrorHandlers();

      logger.info('Application started successfully', {
        port: config.get('server.port'),
        environment: config.get('server.environment'),
        database: dbConnection.isConnected() ? 'connected' : 'disconnected'
      });

    } catch (error) {
      logger.error('Failed to start application', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    }
  }

  /**
   * Validate environment setup
   */
  validateEnvironment() {
    logger.info('Validating environment configuration...');
    
    // Log sanitized configuration in development
    if (config.isDevelopment()) {
      logger.debug('Application configuration', config.getSanitizedConfig());
    }

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion < 16) {
      throw new Error(`Node.js version ${nodeVersion} is not supported. Please use Node.js 16 or higher.`);
    }

    logger.info('Environment validation completed');
  }

  /**
   * Initialize database connection
   */
  async initializeDatabase() {
    logger.info('Initializing database connection...');
    
    try {
      dbConnection.connect();
      
      if (!dbConnection.isConnected()) {
        throw new Error('Database connection failed');
      }

      logger.info('Database connection established', {
        path: config.get('database.path'),
        walMode: config.get('database.enableWAL')
      });

    } catch (error) {
      logger.error('Database initialization failed', {
        error: error.message,
        stack: error.stack,
        databasePath: config.get('database.path')
      });
      throw error;
    }
  }

  /**
   * Start HTTP server
   */
  async startHttpServer() {
    return new Promise((resolve, reject) => {
      const port = config.get('server.port');
      const host = config.get('server.host');

      this.server = app.listen(port, host, (error) => {
        if (error) {
          reject(error);
          return;
        }

        logger.info('HTTP server listening', {
          port,
          host,
          url: `http://${host}:${port}`
        });

        resolve();
      });

      // Handle server errors
      this.server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          logger.error(`Port ${port} is already in use`);
        } else if (error.code === 'EACCES') {
          logger.error(`Permission denied to bind to port ${port}`);
        } else {
          logger.error('Server error', { error: error.message, code: error.code });
        }
        reject(error);
      });

      // Set server timeout
      this.server.timeout = 30000; // 30 seconds
    });
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  setupSignalHandlers() {
    // Handle termination signals
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    
    // Handle Windows signals
    if (process.platform === 'win32') {
      process.on('SIGBREAK', () => this.gracefulShutdown('SIGBREAK'));
    }

    logger.debug('Signal handlers registered');
  }

  /**
   * Setup process error handlers
   */
  setupErrorHandlers() {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception - Application will terminate', {
        error: error.message,
        stack: error.stack,
        pid: process.pid
      });
      
      // Attempt graceful shutdown
      this.gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Promise Rejection - Application will terminate', {
        reason: reason?.message || reason,
        stack: reason?.stack,
        promise: promise.toString(),
        pid: process.pid
      });
      
      // Attempt graceful shutdown
      this.gracefulShutdown('unhandledRejection');
    });

    // Handle warnings
    process.on('warning', (warning) => {
      logger.warn('Process warning', {
        name: warning.name,
        message: warning.message,
        stack: warning.stack
      });
    });

    logger.debug('Error handlers registered');
  }

  /**
   * Perform graceful shutdown
   */
  async gracefulShutdown(signal) {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress, ignoring signal', { signal });
      return;
    }

    this.isShuttingDown = true;
    logger.info(`Received ${signal}. Starting graceful shutdown...`, {
      signal,
      pid: process.pid,
      uptime: process.uptime()
    });

    // Set shutdown timeout
    const shutdownTimer = setTimeout(() => {
      logger.error('Graceful shutdown timeout exceeded, forcing exit', {
        timeout: this.shutdownTimeout
      });
      process.exit(1);
    }, this.shutdownTimeout);

    try {
      // Stop accepting new connections
      if (this.server) {
        logger.info('Closing HTTP server...');
        await new Promise((resolve) => {
          this.server.close(() => {
            logger.info('HTTP server closed');
            resolve();
          });
        });
      }

      // Close database connection
      if (dbConnection.isConnected()) {
        logger.info('Closing database connection...');
        dbConnection.close();
        logger.info('Database connection closed');
      }

      // Clear shutdown timeout
      clearTimeout(shutdownTimer);

      logger.info('Graceful shutdown completed successfully');
      process.exit(0);

    } catch (error) {
      logger.error('Error during graceful shutdown', {
        error: error.message,
        stack: error.stack
      });
      
      clearTimeout(shutdownTimer);
      process.exit(1);
    }
  }

  /**
   * Get server instance
   */
  getServer() {
    return this.server;
  }

  /**
   * Check if server is running
   */
  isRunning() {
    return this.server && this.server.listening;
  }
}

// Start application if this file is run directly
if (require.main === module) {
  const server = new ApplicationServer();
  server.start().catch((error) => {
    console.error('Failed to start application:', error.message);
    process.exit(1);
  });
}

module.exports = ApplicationServer;