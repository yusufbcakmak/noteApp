// Mock dependencies before importing
jest.mock('../../src/utils/jwt');
jest.mock('../../src/services/AuthService');

const authMiddleware = require('../../src/middleware/auth');
const jwtUtils = require('../../src/utils/jwt');
const AuthService = require('../../src/services/AuthService');

describe('Auth Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      headers: {},
      user: null
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should authenticate valid token successfully', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockAuthResult = { user: mockUser, tokenData: { type: 'access' } };

      mockReq.headers.authorization = 'Bearer valid-token';
      jwtUtils.extractTokenFromHeader.mockReturnValue('valid-token');
      authMiddleware.authService.verifyAuth.mockResolvedValue(mockAuthResult);

      await authMiddleware.authenticate(mockReq, mockRes, mockNext);

      expect(jwtUtils.extractTokenFromHeader).toHaveBeenCalledWith('Bearer valid-token');
      expect(authMiddleware.authService.verifyAuth).toHaveBeenCalledWith('valid-token');
      expect(mockReq.user).toBe(mockUser);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject request without authorization header', async () => {
      jwtUtils.extractTokenFromHeader.mockReturnValue(null);

      await authMiddleware.authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Access token is required'
        }
      });
    });

    it('should reject request with invalid token', async () => {
      mockReq.headers.authorization = 'Bearer invalid-token';
      jwtUtils.extractTokenFromHeader.mockReturnValue('invalid-token');
      authMiddleware.authService.verifyAuth.mockRejectedValue(new Error('Invalid token'));

      await authMiddleware.authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTHENTICATION_FAILED',
          message: 'Invalid token'
        }
      });
    });

    it('should handle expired token', async () => {
      mockReq.headers.authorization = 'Bearer expired-token';
      jwtUtils.extractTokenFromHeader.mockReturnValue('expired-token');
      authMiddleware.authService.verifyAuth.mockRejectedValue(new Error('Token expired'));

      await authMiddleware.authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token expired'
        }
      });
    });

    it('should handle deactivated account', async () => {
      mockReq.headers.authorization = 'Bearer valid-token';
      jwtUtils.extractTokenFromHeader.mockReturnValue('valid-token');
      authMiddleware.authService.verifyAuth.mockRejectedValue(new Error('Account deactivated'));

      await authMiddleware.authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'ACCOUNT_DEACTIVATED',
          message: 'Account deactivated'
        }
      });
    });
  });

  describe('optionalAuth', () => {
    it('should authenticate valid token when provided', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockAuthResult = { user: mockUser, tokenData: { type: 'access' } };

      mockReq.headers.authorization = 'Bearer valid-token';
      jwtUtils.extractTokenFromHeader.mockReturnValue('valid-token');
      authMiddleware.authService.verifyAuth.mockResolvedValue(mockAuthResult);

      await authMiddleware.optionalAuth(mockReq, mockRes, mockNext);

      expect(mockReq.user).toBe(mockUser);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should continue without authentication when no token provided', async () => {
      jwtUtils.extractTokenFromHeader.mockReturnValue(null);

      await authMiddleware.optionalAuth(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should continue without authentication when token is invalid', async () => {
      mockReq.headers.authorization = 'Bearer invalid-token';
      jwtUtils.extractTokenFromHeader.mockReturnValue('invalid-token');
      authMiddleware.authService.verifyAuth.mockRejectedValue(new Error('Invalid token'));

      await authMiddleware.optionalAuth(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('requireActiveUser', () => {
    it('should allow access for active user', () => {
      mockReq.user = { id: 'user-123', isActive: true };

      authMiddleware.requireActiveUser(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should deny access for inactive user', () => {
      mockReq.user = { id: 'user-123', isActive: false };

      authMiddleware.requireActiveUser(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'ACCOUNT_DEACTIVATED',
          message: 'Account is deactivated'
        }
      });
    });

    it('should deny access when no user is authenticated', () => {
      mockReq.user = null;

      authMiddleware.requireActiveUser(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        }
      });
    });
  });

  describe('requireOwnership', () => {
    it('should allow access for resource owner', () => {
      const middleware = authMiddleware.requireOwnership('userId');
      mockReq.user = { id: 'user-123' };
      mockReq.params = { userId: 'user-123' };
      mockReq.body = {};

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should deny access for non-owner', () => {
      const middleware = authMiddleware.requireOwnership('userId');
      mockReq.user = { id: 'user-123' };
      mockReq.params = { userId: 'other-user' };
      mockReq.body = {};

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You can only access your own resources'
        }
      });
    });

    it('should deny access when no user is authenticated', () => {
      const middleware = authMiddleware.requireOwnership('userId');
      mockReq.user = null;
      mockReq.params = { userId: 'user-123' };
      mockReq.body = {};

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        }
      });
    });

    it('should handle missing parameter', () => {
      const middleware = authMiddleware.requireOwnership('userId');
      mockReq.user = { id: 'user-123' };
      mockReq.params = {};
      mockReq.body = {};

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_USER_ID',
          message: 'userId is required'
        }
      });
    });
  });

  describe('rateLimitAuth', () => {
    it('should allow requests within rate limit', () => {
      const middleware = authMiddleware.rateLimitAuth(5, 60000); // 5 requests per minute
      mockReq.ip = '127.0.0.1';

      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        middleware(mockReq, mockRes, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(5);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should skip rate limiting in test environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const middleware = authMiddleware.rateLimitAuth(1, 60000);
      mockReq.ip = '127.0.0.1';

      // Make multiple requests (should all pass in test env)
      for (let i = 0; i < 5; i++) {
        middleware(mockReq, mockRes, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(5);
      expect(mockNext).toHaveBeenCalledWith();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('logAuthEvent', () => {
    it('should log authentication events for auth endpoints', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      mockReq.path = '/api/auth/login';
      mockReq.method = 'POST';
      mockReq.ip = '127.0.0.1';
      mockReq.headers = { 'user-agent': 'test-agent' };
      mockReq.user = { id: 'user-123' };

      authMiddleware.logAuthEvent(mockReq, mockRes, mockNext);

      // Simulate response
      mockRes.send('test response');

      expect(consoleSpy).toHaveBeenCalledWith('Auth Event:', expect.stringContaining('127.0.0.1'));
      consoleSpy.mockRestore();
    });

    it('should not log non-auth endpoints', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      mockReq.path = '/api/notes';
      mockReq.method = 'GET';

      authMiddleware.logAuthEvent(mockReq, mockRes, mockNext);

      // Simulate response
      mockRes.send('test response');

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});