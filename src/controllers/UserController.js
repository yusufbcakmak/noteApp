const UserRepository = require('../repositories/UserRepository');
const User = require('../models/User');
const bcrypt = require('bcrypt');

/**
 * User controller for profile management
 */
class UserController {
  constructor() {
    this.userRepository = null;
  }

  /**
   * Initialize controller with dependencies
   */
  init() {
    this.userRepository = new UserRepository().init();
    return this;
  }

  /**
   * Get user profile
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getProfile = async (req, res) => {
    try {
      const userId = req.user.id;
      const user = await this.userRepository.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          },
          timestamp: new Date().toISOString()
        });
      }

      // Return user profile without sensitive data
      const profile = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt
      };

      res.json({
        success: true,
        data: { profile },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get user profile'
        },
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Update user profile
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  updateProfile = async (req, res) => {
    try {
      const userId = req.user.id;
      const { firstName, lastName, email, currentPassword, newPassword } = req.body;

      // Validate input
      const errors = [];

      if (email && !this._isValidEmail(email)) {
        errors.push('Invalid email format');
      }

      if (firstName && (typeof firstName !== 'string' || firstName.trim().length === 0)) {
        errors.push('First name must be a non-empty string');
      }

      if (lastName && (typeof lastName !== 'string' || lastName.trim().length === 0)) {
        errors.push('Last name must be a non-empty string');
      }

      if (newPassword && (!currentPassword || typeof currentPassword !== 'string')) {
        errors.push('Current password is required to change password');
      }

      if (newPassword && (typeof newPassword !== 'string' || newPassword.length < 6)) {
        errors.push('New password must be at least 6 characters long');
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors
          },
          timestamp: new Date().toISOString()
        });
      }

      // Get current user
      const currentUser = await this.userRepository.findById(userId);
      if (!currentUser) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          },
          timestamp: new Date().toISOString()
        });
      }

      // Check if email is already taken by another user
      if (email && email.toLowerCase() !== currentUser.email.toLowerCase()) {
        const emailExists = await this.userRepository.emailExists(email, userId);
        if (emailExists) {
          return res.status(409).json({
            success: false,
            error: {
              code: 'EMAIL_ALREADY_EXISTS',
              message: 'Email is already taken by another user'
            },
            timestamp: new Date().toISOString()
          });
        }
      }

      // Verify current password if changing password
      if (newPassword) {
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, currentUser.password);
        if (!isCurrentPasswordValid) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_CURRENT_PASSWORD',
              message: 'Current password is incorrect'
            },
            timestamp: new Date().toISOString()
          });
        }
      }

      // Prepare update data
      const updateData = {};
      if (firstName !== undefined) updateData.firstName = firstName.trim();
      if (lastName !== undefined) updateData.lastName = lastName.trim();
      if (email !== undefined) updateData.email = email.toLowerCase().trim();
      if (newPassword) updateData.password = newPassword;

      // Update user
      const updatedUser = await this.userRepository.update(userId, updateData);

      if (!updatedUser) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'UPDATE_FAILED',
            message: 'Failed to update user profile'
          },
          timestamp: new Date().toISOString()
        });
      }

      // Return updated profile without sensitive data
      const profile = {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
        lastLoginAt: updatedUser.lastLoginAt
      };

      res.json({
        success: true,
        data: { profile },
        message: 'Profile updated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update user profile'
        },
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Delete user account
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  deleteAccount = async (req, res) => {
    try {
      const userId = req.user.id;
      const { password, confirmation } = req.body;

      // Validate input
      const errors = [];

      if (!password || typeof password !== 'string') {
        errors.push('Password is required for account deletion');
      }

      if (!confirmation || confirmation !== 'DELETE_MY_ACCOUNT') {
        errors.push('Confirmation must be exactly "DELETE_MY_ACCOUNT"');
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors
          },
          timestamp: new Date().toISOString()
        });
      }

      // Get current user
      const currentUser = await this.userRepository.findById(userId);
      if (!currentUser) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          },
          timestamp: new Date().toISOString()
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, currentUser.password);
      if (!isPasswordValid) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PASSWORD',
            message: 'Password is incorrect'
          },
          timestamp: new Date().toISOString()
        });
      }

      // Delete user account (hard delete to cascade delete all related data)
      const deleted = await this.userRepository.hardDelete(userId);

      if (!deleted) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'DELETE_FAILED',
            message: 'Failed to delete user account'
          },
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        message: 'Account deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Delete account error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete user account'
        },
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} - True if valid
   */
  _isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

module.exports = UserController;