// Mock the AuthService before importing
jest.mock('../../src/services/AuthService');

const request = require('supertest');
const express = require('express');
const AuthController = require('../../src/controllers/AuthController');
const AuthService = require('../../src/services/AuthService');
const { ValidationError, AuthenticationError } = require('../../src/utils/errors');

describe('AuthController', () => {
  let app;
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    mockReq = {
      body: {},
      user: { id: 'user-123' }
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockTokens = { accessToken: 'access-token', refreshToken: 'refresh-token' };

      AuthService.register.mockResolvedValue({ user: mockUser, tokens: mockTokens });

      mockReq.body = userData;

      await AuthController.register(mockReq, mockRes, mockNext);

      expect(AuthService.register).toHaveBeenCalledWith(userData);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'User registered successfully',
        data: {
          user: mockUser,
          tokens: mockTokens
        }
      });
    });

    it('should handle registration errors', async () => {
      const error = new ValidationError('Email already exists');
      AuthService.register.mockRejectedValue(error);

      mockReq.body = { email: 'test@example.com', password: 'password123' };

      await AuthController.register(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };

      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockTokens = { accessToken: 'access-token', refreshToken: 'refresh-token' };

      AuthService.login.mockResolvedValue({ user: mockUser, tokens: mockTokens });

      mockReq.body = loginData;

      await AuthController.login(mockReq, mockRes, mockNext);

      expect(AuthService.login).toHaveBeenCalledWith(loginData.email, loginData.password);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Login successful',
        data: {
          user: mockUser,
          tokens: mockTokens
        }
      });
    });

    it('should handle login errors', async () => {
      const error = new AuthenticationError('Invalid credentials');
      AuthService.login.mockRejectedValue(error);

      mockReq.body = { email: 'test@example.com', password: 'wrong-password' };

      await AuthController.login(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      AuthService.logout.mockResolvedValue();

      await AuthController.logout(mockReq, mockRes, mockNext);

      expect(AuthService.logout).toHaveBeenCalledWith('user-123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logout successful'
      });
    });

    it('should handle logout errors', async () => {
      const error = new Error('Logout failed');
      AuthService.logout.mockRejectedValue(error);

      await AuthController.logout(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const refreshToken = 'refresh-token';
      const mockTokens = { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' };

      AuthService.refreshToken.mockResolvedValue(mockTokens);

      mockReq.body = { refreshToken };

      await AuthController.refreshToken(mockReq, mockRes, mockNext);

      expect(AuthService.refreshToken).toHaveBeenCalledWith(refreshToken);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Token refreshed successfully',
        data: { tokens: mockTokens }
      });
    });

    it('should handle refresh token errors', async () => {
      const error = new AuthenticationError('Invalid refresh token');
      AuthService.refreshToken.mockRejectedValue(error);

      mockReq.body = { refreshToken: 'invalid-token' };

      await AuthController.refreshToken(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getProfile', () => {
    it('should get user profile successfully', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com', firstName: 'John' };

      AuthService.getUserById.mockResolvedValue(mockUser);

      await AuthController.getProfile(mockReq, mockRes, mockNext);

      expect(AuthService.getUserById).toHaveBeenCalledWith('user-123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { user: mockUser }
      });
    });

    it('should handle get profile errors', async () => {
      const error = new Error('User not found');
      AuthService.getUserById.mockRejectedValue(error);

      await AuthController.getProfile(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('forgotPassword', () => {
    it('should handle forgot password successfully', async () => {
      const email = 'test@example.com';

      AuthService.forgotPassword.mockResolvedValue();

      mockReq.body = { email };

      await AuthController.forgotPassword(mockReq, mockRes, mockNext);

      expect(AuthService.forgotPassword).toHaveBeenCalledWith(email);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password reset email sent'
      });
    });

    it('should handle forgot password errors', async () => {
      const error = new Error('Email not found');
      AuthService.forgotPassword.mockRejectedValue(error);

      mockReq.body = { email: 'nonexistent@example.com' };

      await AuthController.forgotPassword(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      const resetData = {
        token: 'reset-token',
        newPassword: 'newpassword123'
      };

      AuthService.resetPassword.mockResolvedValue();

      mockReq.body = resetData;

      await AuthController.resetPassword(mockReq, mockRes, mockNext);

      expect(AuthService.resetPassword).toHaveBeenCalledWith(resetData.token, resetData.newPassword);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password reset successfully'
      });
    });

    it('should handle reset password errors', async () => {
      const error = new AuthenticationError('Invalid reset token');
      AuthService.resetPassword.mockRejectedValue(error);

      mockReq.body = { token: 'invalid-token', newPassword: 'newpassword123' };

      await AuthController.resetPassword(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('verifyToken', () => {
    it('should verify token successfully', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      AuthService.getUserById.mockResolvedValue(mockUser);

      await AuthController.verifyToken(mockReq, mockRes, mockNext);

      expect(AuthService.getUserById).toHaveBeenCalledWith('user-123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { user: mockUser }
      });
    });

    it('should handle verify token errors', async () => {
      const error = new Error('User not found');
      AuthService.getUserById.mockRejectedValue(error);

      await AuthController.verifyToken(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});