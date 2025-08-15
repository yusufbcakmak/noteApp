const User = require('../models/User');
const UserRepository = require('../repositories/UserRepository');
const jwtUtils = require('../utils/jwt');
const dbConnection = require('../config/database');

/**
 * Authentication service for handling user authentication operations
 */
class AuthService {
  constructor() {
    this.userRepository = new UserRepository();
  }

  /**
   * Initialize service with database connection
   */
  init() {
    this.userRepository.init();
    return this;
  }

  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} - Registration result with user and tokens
   */
  async register(userData) {
    try {
      // Validate registration data
      const { error, value } = User.validate(userData, User.registrationSchema);
      if (error) {
        throw new Error(`Validation failed: ${error.details.map(d => d.message).join(', ')}`);
      }

      // Check if email already exists
      const existingUser = await this.userRepository.findByEmailIncludingInactive(value.email);
      if (existingUser) {
        throw new Error('Email already exists');
      }

      // Create new user
      const newUser = await this.userRepository.create(value);

      // Generate tokens
      const tokens = jwtUtils.generateTokenPair(newUser);

      // Update last login
      await this.userRepository.updateLastLogin(newUser.id);

      return {
        success: true,
        message: 'User registered successfully',
        user: newUser.toJSON(),
        tokens
      };
    } catch (error) {
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  /**
   * Login user with email and password
   * @param {Object} loginData - Login credentials
   * @returns {Promise<Object>} - Login result with user and tokens
   */
  async login(loginData) {
    try {
      // Validate login data
      const { error, value } = User.validate(loginData, User.loginSchema);
      if (error) {
        throw new Error(`Validation failed: ${error.details.map(d => d.message).join(', ')}`);
      }

      // Find user by email
      const user = await this.userRepository.findByEmail(value.email);
      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Verify password
      const isPasswordValid = await User.comparePassword(value.password, user.password);
      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }

      // Check if user is active
      if (!user.isUserActive()) {
        throw new Error('Account is deactivated');
      }

      // Generate tokens
      const tokens = jwtUtils.generateTokenPair(user);

      // Update last login
      await this.userRepository.updateLastLogin(user.id);

      return {
        success: true,
        message: 'Login successful',
        user: user.toJSON(),
        tokens
      };
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} - New tokens
   */
  async refreshToken(refreshToken) {
    try {
      if (!refreshToken) {
        throw new Error('Refresh token is required');
      }

      // Verify refresh token
      const decoded = jwtUtils.verifyRefreshToken(refreshToken);
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Find user
      const user = await this.userRepository.findById(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if user is active
      if (!user.isUserActive()) {
        throw new Error('Account is deactivated');
      }

      // Generate new tokens
      const tokens = jwtUtils.generateTokenPair(user);

      return {
        success: true,
        message: 'Token refreshed successfully',
        tokens
      };
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Logout user (in a stateless JWT system, this is mainly for client-side cleanup)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Logout result
   */
  async logout(userId) {
    try {
      // In a stateless JWT system, we don't need to do much server-side
      // This method exists for consistency and potential future token blacklisting
      
      return {
        success: true,
        message: 'Logout successful'
      };
    } catch (error) {
      throw new Error(`Logout failed: ${error.message}`);
    }
  }

  /**
   * Verify user authentication using access token
   * @param {string} accessToken - Access token
   * @returns {Promise<Object>} - User data if valid
   */
  async verifyAuth(accessToken) {
    try {
      if (!accessToken) {
        throw new Error('Access token is required');
      }

      // Verify access token
      const decoded = jwtUtils.verifyAccessToken(accessToken);
      
      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      // Find user
      const user = await this.userRepository.findById(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if user is active
      if (!user.isUserActive()) {
        throw new Error('Account is deactivated');
      }

      return {
        success: true,
        user: user.toJSON(),
        tokenData: decoded
      };
    } catch (error) {
      throw new Error(`Authentication verification failed: ${error.message}`);
    }
  }

  /**
   * Change user password
   * @param {string} userId - User ID
   * @param {Object} passwordData - Password change data
   * @returns {Promise<Object>} - Password change result
   */
  async changePassword(userId, passwordData) {
    try {
      // Validate password change data
      const { error, value } = User.validate(passwordData, User.passwordChangeSchema);
      if (error) {
        throw new Error(`Validation failed: ${error.details.map(d => d.message).join(', ')}`);
      }

      // Find user
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await User.comparePassword(value.currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Update password
      await this.userRepository.update(userId, { password: value.newPassword });

      return {
        success: true,
        message: 'Password changed successfully'
      };
    } catch (error) {
      throw new Error(`Password change failed: ${error.message}`);
    }
  }

  /**
   * Request password reset (placeholder for future email functionality)
   * @param {string} email - User email
   * @returns {Promise<Object>} - Password reset request result
   */
  async requestPasswordReset(email) {
    try {
      // Find user by email
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        // Don't reveal if email exists or not for security
        return {
          success: true,
          message: 'If the email exists, a password reset link has been sent'
        };
      }

      // TODO: Generate password reset token and send email
      // For now, just return success message
      
      return {
        success: true,
        message: 'If the email exists, a password reset link has been sent'
      };
    } catch (error) {
      throw new Error(`Password reset request failed: ${error.message}`);
    }
  }

  /**
   * Get user profile
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - User profile data
   */
  async getUserProfile(userId) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      return {
        success: true,
        user: user.toJSON()
      };
    } catch (error) {
      throw new Error(`Failed to get user profile: ${error.message}`);
    }
  }

  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {Object} updateData - Profile update data
   * @returns {Promise<Object>} - Updated user profile
   */
  async updateUserProfile(userId, updateData) {
    try {
      // Validate update data
      const { error, value } = User.validate(updateData, User.updateSchema);
      if (error) {
        throw new Error(`Validation failed: ${error.details.map(d => d.message).join(', ')}`);
      }

      // Check if email is being changed and if it already exists
      if (value.email) {
        const emailExists = await this.userRepository.emailExists(value.email, userId);
        if (emailExists) {
          throw new Error('Email already exists');
        }
      }

      // Update user
      const updatedUser = await this.userRepository.update(userId, value);
      if (!updatedUser) {
        throw new Error('User not found');
      }

      return {
        success: true,
        message: 'Profile updated successfully',
        user: updatedUser.toJSON()
      };
    } catch (error) {
      throw new Error(`Profile update failed: ${error.message}`);
    }
  }

  /**
   * Delete user account
   * @param {string} userId - User ID
   * @param {string} password - User password for confirmation
   * @returns {Promise<Object>} - Account deletion result
   */
  async deleteAccount(userId, password) {
    try {
      // Find user
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify password
      const isPasswordValid = await User.comparePassword(password, user.password);
      if (!isPasswordValid) {
        throw new Error('Password is incorrect');
      }

      // Soft delete user (set is_active to false)
      const deleted = await this.userRepository.softDelete(userId);
      if (!deleted) {
        throw new Error('Failed to delete account');
      }

      return {
        success: true,
        message: 'Account deleted successfully'
      };
    } catch (error) {
      throw new Error(`Account deletion failed: ${error.message}`);
    }
  }
}

module.exports = AuthService;