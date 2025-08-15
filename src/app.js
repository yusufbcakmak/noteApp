const express = require('express');
const config = require('./config/environment');
const SecurityMiddleware = require('./middleware/security');
const ErrorHandler = require('./middleware/errorHandler');
const RequestLogger = require('./middleware/requestLogger');
const SwaggerConfig = require('./config/swagger');
const ContractValidation = require('./middleware/contractValidation');
const logger = require('./utils/logger');

const app = express();

// Apply security middleware stack
const securityMiddlewares = SecurityMiddleware.createSecurityStack({
  enableRateLimit: config.get('security.enableRateLimit'),
  enableCors: config.get('security.enableCors'),
  enableHelmet: config.get('security.enableHelmet'),
  corsOrigin: config.get('security.corsOrigin')
});

securityMiddlewares.forEach(middleware => {
  app.use(middleware);
});

// Request ID middleware (must be before other middleware)
app.use(ErrorHandler.createRequestIdMiddleware());

// Body parsing middleware with size limits
const sizeLimits = SecurityMiddleware.createSizeLimitMiddleware();
app.use(express.json(sizeLimits.json));
app.use(express.urlencoded(sizeLimits.urlencoded));

// Request logging middleware
app.use(RequestLogger.createRequestLogger({
  logLevel: config.get('logging.level'),
  logBody: config.isDevelopment(),
  skipSuccessfulGET: config.isProduction()
}));

// Slow request logger
app.use(RequestLogger.createSlowRequestLogger(2000)); // Log requests taking more than 2 seconds

// Security event logger
app.use(RequestLogger.createSecurityLogger());

// Validation error handler (for Joi validation errors)
app.use(ErrorHandler.handleValidationError);

// Placeholder for API routes (will be initialized after database connection)
let routesInitialized = false;

// Basic health check endpoint
app.get('/health', (req, res) => {
  const dbConnection = require('./config/database');
  const health = {
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: config.get('server.environment'),
    version: config.get('app.version'),
    database: dbConnection.isConnected() ? 'connected' : 'disconnected',
    uptime: process.uptime()
  };
  
  logger.debug('Health check requested', health);
  res.json(health);
});

// Swagger documentation (in development and test modes)
if (config.isDevelopment() || config.get('server.environment') === 'test') {
  const swaggerConfig = new SwaggerConfig();
  app.use('/api-docs', swaggerConfig.getServeMiddleware(), swaggerConfig.getUiMiddleware());
  
  // API contract validation endpoint
  app.get('/api/contract/validate', async (req, res) => {
    try {
      const contractValidation = new ContractValidation();
      await contractValidation.init();
      const report = await contractValidation.getValidationReport();
      res.json({ success: true, data: report });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: { code: 'CONTRACT_VALIDATION_ERROR', message: error.message } 
      });
    }
  });

  // OpenAPI spec endpoint
  app.get('/api/openapi.json', (req, res) => {
    const swaggerConfig = new SwaggerConfig();
    const spec = swaggerConfig.getSpec();
    res.json(spec);
  });
}

// Basic route
app.get('/', (req, res) => {
  res.json({ 
    message: config.get('app.name'),
    version: config.get('app.version'),
    environment: config.get('server.environment'),
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      notes: '/api/notes',
      history: '/api/history',
      groups: '/api/groups',
      user: '/api/user',
      archive: '/api/archive',
      ...((config.isDevelopment() || config.get('server.environment') === 'test') && {
        docs: '/api-docs',
        openapi: '/api/openapi.json',
        contract: '/api/contract/validate'
      })
    }
  });
});

/**
 * Initialize API routes after database connection is established
 */
function initializeRoutes() {
  if (routesInitialized) {
    logger.warn('Routes already initialized, skipping...');
    return;
  }

  const AuthRoutes = require('./routes/auth');
  const NoteRoutes = require('./routes/notes');
  const HistoryRoutes = require('./routes/history');
  const GroupRoutes = require('./routes/groups');
  const UserRoutes = require('./routes/user');
  const ArchiveRoutes = require('./routes/archive');

  // Initialize routes
  const authRoutes = new AuthRoutes().init();
  const noteRoutes = new NoteRoutes().init();
  const historyRoutes = new HistoryRoutes().init();
  const groupRoutes = new GroupRoutes().init();
  const userRoutes = new UserRoutes().init();
  const archiveRoutes = new ArchiveRoutes().init();

  // Mount routes BEFORE 404 handler
  app.use('/api/auth', authRoutes.getRouter());
  app.use('/api/notes', noteRoutes.getRouter());
  app.use('/api/history', historyRoutes.getRouter());
  app.use('/api/groups', groupRoutes.getRouter());
  app.use('/api/user', userRoutes.getRouter());
  app.use('/api/archive', archiveRoutes.getRouter());

  // Now add 404 handler (must be after routes but before global error handler)
  app.use(ErrorHandler.createNotFoundHandler());

  // Global error handler (must be last)
  app.use(ErrorHandler.createGlobalErrorHandler());

  routesInitialized = true;
  logger.info('API routes initialized successfully');
}

// Export app and initialization function
module.exports = {
  app,
  initializeRoutes
};