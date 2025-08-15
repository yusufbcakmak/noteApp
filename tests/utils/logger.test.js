// Mock winston to capture log calls
const mockLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  http: jest.fn(),
  verbose: jest.fn(),
  silly: jest.fn(),
  log: jest.fn(),
  child: jest.fn(),
  exceptions: { handle: jest.fn() },
  rejections: { handle: jest.fn() }
};

// Set up child logger to return itself for chaining
mockLogger.child.mockReturnValue(mockLogger);

jest.mock('winston', () => ({
  createLogger: jest.fn(() => mockLogger),
  format: {
    combine: jest.fn(() => 'combined-format'),
    timestamp: jest.fn(() => 'timestamp-format'),
    errors: jest.fn(() => 'errors-format'),
    json: jest.fn(() => 'json-format'),
    prettyPrint: jest.fn(() => 'prettyPrint-format'),
    colorize: jest.fn(() => 'colorize-format'),
    printf: jest.fn(() => 'printf-format')
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

const logger = require('../../src/utils/logger');
const winston = require('winston');

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic logging methods', () => {
    test('should log error messages', () => {
      const message = 'Test error message';
      const meta = { userId: '123' };
      
      logger.error(message, meta);
      
      expect(mockLogger.error).toHaveBeenCalledWith(message, meta);
    });

    test('should log warning messages', () => {
      const message = 'Test warning message';
      const meta = { action: 'test' };
      
      logger.warn(message, meta);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(message, meta);
    });

    test('should log info messages', () => {
      const message = 'Test info message';
      const meta = { status: 'success' };
      
      logger.info(message, meta);
      
      expect(mockLogger.info).toHaveBeenCalledWith(message, meta);
    });

    test('should log debug messages', () => {
      const message = 'Test debug message';
      const meta = { debug: true };
      
      logger.debug(message, meta);
      
      expect(mockLogger.debug).toHaveBeenCalledWith(message, meta);
    });

    test('should log http messages', () => {
      const message = 'Test http message';
      const meta = { method: 'GET' };
      
      logger.http(message, meta);
      
      expect(mockLogger.http).toHaveBeenCalledWith(message, meta);
    });

    test('should log verbose messages', () => {
      const message = 'Test verbose message';
      
      logger.verbose(message);
      
      expect(mockLogger.verbose).toHaveBeenCalledWith(message, {});
    });

    test('should log silly messages', () => {
      const message = 'Test silly message';
      
      logger.silly(message);
      
      expect(mockLogger.silly).toHaveBeenCalledWith(message, {});
    });
  });

  describe('Child logger methods', () => {
    test('should create child logger with request ID', () => {
      const requestId = 'test-request-id';
      
      logger.withRequestId(requestId);
      
      expect(mockLogger.child).toHaveBeenCalledWith({ requestId });
    });

    test('should create child logger with user ID', () => {
      const userId = 'test-user-id';
      
      logger.withUserId(userId);
      
      expect(mockLogger.child).toHaveBeenCalledWith({ userId });
    });

    test('should create child logger with custom meta', () => {
      const meta = { custom: 'data' };
      
      logger.child(meta);
      
      expect(mockLogger.child).toHaveBeenCalledWith(meta);
    });
  });

  describe('Specialized logging methods', () => {
    test('should log database operations', () => {
      const operation = 'SELECT';
      const meta = { table: 'users' };
      
      logger.database(operation, meta);
      
      expect(mockLogger.debug).toHaveBeenCalledWith('Database SELECT', {
        category: 'database',
        operation: 'SELECT',
        table: 'users'
      });
    });

    test('should log authentication events', () => {
      const event = 'login';
      const meta = { userId: '123' };
      
      logger.auth(event, meta);
      
      expect(mockLogger.info).toHaveBeenCalledWith('Auth login', {
        category: 'authentication',
        event: 'login',
        userId: '123'
      });
    });

    test('should log API requests with info level for success', () => {
      const method = 'GET';
      const path = '/api/users';
      const statusCode = 200;
      const responseTime = 150;
      const meta = { userId: '123' };
      
      logger.api(method, path, statusCode, responseTime, meta);
      
      expect(mockLogger.log).toHaveBeenCalledWith('info', 'GET /api/users 200 - 150ms', {
        category: 'api',
        method: 'GET',
        path: '/api/users',
        statusCode: 200,
        responseTime: 150,
        userId: '123'
      });
    });

    test('should log API requests with warn level for client errors', () => {
      const method = 'POST';
      const path = '/api/users';
      const statusCode = 400;
      const responseTime = 50;
      
      logger.api(method, path, statusCode, responseTime);
      
      expect(mockLogger.log).toHaveBeenCalledWith('warn', 'POST /api/users 400 - 50ms', {
        category: 'api',
        method: 'POST',
        path: '/api/users',
        statusCode: 400,
        responseTime: 50
      });
    });

    test('should log security events', () => {
      const event = 'failed_login';
      const meta = { ip: '192.168.1.1' };
      
      logger.security(event, meta);
      
      expect(mockLogger.warn).toHaveBeenCalledWith('Security failed_login', {
        category: 'security',
        event: 'failed_login',
        ip: '192.168.1.1'
      });
    });

    test('should log performance metrics', () => {
      const metric = 'response_time';
      const value = 250;
      const meta = { endpoint: '/api/users' };
      
      logger.performance(metric, value, meta);
      
      expect(mockLogger.info).toHaveBeenCalledWith('Performance response_time: 250', {
        category: 'performance',
        metric: 'response_time',
        value: 250,
        endpoint: '/api/users'
      });
    });
  });

  describe('Logger configuration', () => {
    test('should return underlying Winston logger', () => {
      const winstonLogger = logger.getLogger();
      
      expect(winstonLogger).toBe(mockLogger);
    });
  });
});