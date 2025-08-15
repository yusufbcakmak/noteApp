const AuthService = require('../../src/services/AuthService');
const User = require('../../src/models/User');
const UserRepository = require('../../src/repositories/UserRepository');
const jwtUtils = require('../../src/utils/jwt');
const dbConnection = require('../../src/config/database');
const fs = require('fs');
const path = require('path');

// Mock the UserRepository
jest.mock('../../src/repositories/UserRepository');

describe('AuthService', () => {
  let authService;
  let mockUserRepository;

  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    password: 'hashedpassword',
    firstName: 'John',
    lastName: 'Doe',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    toJSON: () => ({
      id: 'test-user-id',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    }),
    isUserActive: () => true
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock repository instance
    mockUserRepository = {
      init: jest.fn().mockReturnThis(),
      create: jest.fn(),
      findByEmail: jest.fn(),
      findByEmailIncludingInactive: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      updateLastLogin: jest.fn(),
      softDelete: jest.fn(),
      emailExists: jest.fn()
    };

    // Mock the UserRepository constructor
    UserRepository.mockImplementation(() => mockUserRepository);

    authService = new AuthService().init();
  });

  describe('register', () => {
    const validRegistrationData = {
      email: 'test@example.com',
      password: 'Password123',
      firstName: 'John',
      lastName: 'Doe'
    };

    it('should register a new user successfully', async () => {
      mockUserRepository.findByEmailIncludingInactive.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(mockUser);
      mockUserRepository.updateLastLogin.mockResolvedValue(true);

      const result = await authService.register(validRegistrationData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('User registered successfully');
      expect(result.user).toEqual(mockUser.toJSON());
      expect(result.tokens).toHaveProperty('accessToken');
      expect(result.tokens).toHaveProperty('refreshToken');
      expect(mockUserRepository.create).toHaveBeenCalledWith(validRegistrationData);
      expect(mockUserRepository.updateLastLogin).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw error for invalid registration data', async () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'weak'
      };

      await expect(authService.register(invalidData))
        .rejects.toThrow('Registration failed: Validation failed:');
    });

    it('should throw error for existing email', async () => {
      mockUserRepository.findByEmailIncludingInactive.mockResolvedValue(mockUser);

      await expect(authService.register(validRegistrationData))
        .rejects.toThrow('Registration failed: Email already exists');
    });

    it('should handle repository errors', async () => {
      mockUserRepository.findByEmailIncludingInactive.mockResolvedValue(null);
      mockUserRepository.create.mockRejectedValue(new Error('Database error'));

      await expect(authService.register(validRegistrationData))
        .rejects.toThrow('Registration failed: Database error');
    });
  });

  describe('login', () => {
    const validLoginData = {
      email: 'test@example.com',
      password: 'Password123'
    };

    beforeEach(() => {
      // Mock password comparison
      jest.spyOn(User, 'comparePassword').mockResolvedValue(true);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should login user successfully', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockUserRepository.updateLastLogin.mockResolvedValue(true);

      const result = await authService.login(validLoginData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Login successful');
      expect(result.user).toEqual(mockUser.toJSON());
      expect(result.tokens).toHaveProperty('accessToken');
      expect(result.tokens).toHaveProperty('refreshToken');
      expect(User.comparePassword).toHaveBeenCalledWith(validLoginData.password, mockUser.password);
      expect(mockUserRepository.updateLastLogin).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw error for invalid login data', async () => {
      const invalidData = {
        email: 'invalid-email'
      };

      await expect(authService.login(invalidData))
        .rejects.toThrow('Login failed: Validation failed:');
    });

    it('should throw error for non-existent user', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(authService.login(validLoginData))
        .rejects.toThrow('Login failed: Invalid email or password');
    });

    it('should throw error for incorrect password', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      User.comparePassword.mockResolvedValue(false);

      await expect(authService.login(validLoginData))
        .rejects.toThrow('Login failed: Invalid email or password');
    });

    it('should throw error for inactive user', async () => {
      const inactiveUser = {
        ...mockUser,
        isUserActive: () => false
      };
      mockUserRepository.findByEmail.mockResolvedValue(inactiveUser);

      await expect(authService.login(validLoginData))
        .rejects.toThrow('Login failed: Account is deactivated');
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const refreshToken = jwtUtils.generateRefreshToken({ userId: mockUser.id });
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await authService.refreshToken(refreshToken);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Token refreshed successfully');
      expect(result.tokens).toHaveProperty('accessToken');
      expect(result.tokens).toHaveProperty('refreshToken');
    });

    it('should throw error for missing refresh token', async () => {
      await expect(authService.refreshToken(null))
        .rejects.toThrow('Token refresh failed: Refresh token is required');
    });

    it('should throw error for invalid refresh token', async () => {
      await expect(authService.refreshToken('invalid-token'))
        .rejects.toThrow('Token refresh failed:');
    });

    it('should throw error for non-existent user', async () => {
      const refreshToken = jwtUtils.generateRefreshToken({ userId: 'non-existent-id' });
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(authService.refreshToken(refreshToken))
        .rejects.toThrow('Token refresh failed: User not found');
    });

    it('should throw error for inactive user', async () => {
      const refreshToken = jwtUtils.generateRefreshToken({ userId: mockUser.id });
      const inactiveUser = {
        ...mockUser,
        isUserActive: () => false
      };
      mockUserRepository.findById.mockResolvedValue(inactiveUser);

      await expect(authService.refreshToken(refreshToken))
        .rejects.toThrow('Token refresh failed: Account is deactivated');
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      const result = await authService.logout(mockUser.id);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Logout successful');
    });
  });

  describe('verifyAuth', () => {
    it('should verify authentication successfully', async () => {
      const accessToken = jwtUtils.generateAccessToken({ userId: mockUser.id });
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await authService.verifyAuth(accessToken);

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser.toJSON());
      expect(result.tokenData).toBeDefined();
    });

    it('should throw error for missing access token', async () => {
      await expect(authService.verifyAuth(null))
        .rejects.toThrow('Authentication verification failed: Access token is required');
    });

    it('should throw error for invalid access token', async () => {
      await expect(authService.verifyAuth('invalid-token'))
        .rejects.toThrow('Authentication verification failed:');
    });

    it('should throw error for non-existent user', async () => {
      const accessToken = jwtUtils.generateAccessToken({ userId: 'non-existent-id' });
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(authService.verifyAuth(accessToken))
        .rejects.toThrow('Authentication verification failed: User not found');
    });
  });

  describe('changePassword', () => {
    const passwordChangeData = {
      currentPassword: 'OldPassword123',
      newPassword: 'NewPassword123'
    };

    beforeEach(() => {
      jest.spyOn(User, 'comparePassword').mockResolvedValue(true);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should change password successfully', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.update.mockResolvedValue(mockUser);

      const result = await authService.changePassword(mockUser.id, passwordChangeData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Password changed successfully');
      expect(User.comparePassword).toHaveBeenCalledWith(passwordChangeData.currentPassword, mockUser.password);
      expect(mockUserRepository.update).toHaveBeenCalledWith(mockUser.id, { password: passwordChangeData.newPassword });
    });

    it('should throw error for invalid password change data', async () => {
      const invalidData = {
        currentPassword: 'old',
        newPassword: 'weak'
      };

      await expect(authService.changePassword(mockUser.id, invalidData))
        .rejects.toThrow('Password change failed: Validation failed:');
    });

    it('should throw error for non-existent user', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(authService.changePassword('non-existent-id', passwordChangeData))
        .rejects.toThrow('Password change failed: User not found');
    });

    it('should throw error for incorrect current password', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      User.comparePassword.mockResolvedValue(false);

      await expect(authService.changePassword(mockUser.id, passwordChangeData))
        .rejects.toThrow('Password change failed: Current password is incorrect');
    });
  });

  describe('requestPasswordReset', () => {
    it('should handle password reset request', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      const result = await authService.requestPasswordReset('test@example.com');

      expect(result.success).toBe(true);
      expect(result.message).toBe('If the email exists, a password reset link has been sent');
    });

    it('should handle non-existent email gracefully', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      const result = await authService.requestPasswordReset('nonexistent@example.com');

      expect(result.success).toBe(true);
      expect(result.message).toBe('If the email exists, a password reset link has been sent');
    });
  });

  describe('getUserProfile', () => {
    it('should get user profile successfully', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await authService.getUserProfile(mockUser.id);

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser.toJSON());
    });

    it('should throw error for non-existent user', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(authService.getUserProfile('non-existent-id'))
        .rejects.toThrow('Failed to get user profile: User not found');
    });
  });

  describe('updateUserProfile', () => {
    const updateData = {
      firstName: 'Jane',
      lastName: 'Smith'
    };

    it('should update user profile successfully', async () => {
      const updatedUser = { ...mockUser, firstName: 'Jane', lastName: 'Smith' };
      mockUserRepository.emailExists.mockResolvedValue(false);
      mockUserRepository.update.mockResolvedValue(updatedUser);

      const result = await authService.updateUserProfile(mockUser.id, updateData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Profile updated successfully');
      expect(mockUserRepository.update).toHaveBeenCalledWith(mockUser.id, updateData);
    });

    it('should throw error for invalid update data', async () => {
      const invalidData = {
        email: 'invalid-email'
      };

      await expect(authService.updateUserProfile(mockUser.id, invalidData))
        .rejects.toThrow('Profile update failed: Validation failed:');
    });

    it('should throw error for existing email', async () => {
      const updateDataWithEmail = { ...updateData, email: 'existing@example.com' };
      mockUserRepository.emailExists.mockResolvedValue(true);

      await expect(authService.updateUserProfile(mockUser.id, updateDataWithEmail))
        .rejects.toThrow('Profile update failed: Email already exists');
    });

    it('should throw error for non-existent user', async () => {
      mockUserRepository.emailExists.mockResolvedValue(false);
      mockUserRepository.update.mockResolvedValue(null);

      await expect(authService.updateUserProfile('non-existent-id', updateData))
        .rejects.toThrow('Profile update failed: User not found');
    });
  });

  describe('deleteAccount', () => {
    beforeEach(() => {
      jest.spyOn(User, 'comparePassword').mockResolvedValue(true);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should delete account successfully', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.softDelete.mockResolvedValue(true);

      const result = await authService.deleteAccount(mockUser.id, 'Password123');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Account deleted successfully');
      expect(User.comparePassword).toHaveBeenCalledWith('Password123', mockUser.password);
      expect(mockUserRepository.softDelete).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw error for non-existent user', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(authService.deleteAccount('non-existent-id', 'Password123'))
        .rejects.toThrow('Account deletion failed: User not found');
    });

    it('should throw error for incorrect password', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      User.comparePassword.mockResolvedValue(false);

      await expect(authService.deleteAccount(mockUser.id, 'WrongPassword'))
        .rejects.toThrow('Account deletion failed: Password is incorrect');
    });

    it('should throw error if deletion fails', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.softDelete.mockResolvedValue(false);

      await expect(authService.deleteAccount(mockUser.id, 'Password123'))
        .rejects.toThrow('Account deletion failed: Failed to delete account');
    });
  });
});