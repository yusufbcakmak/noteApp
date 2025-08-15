const Joi = require('joi');
const bcrypt = require('bcrypt');

/**
 * User model with validation and business logic
 */
class User {
  constructor(data = {}) {
    this.id = data.id || null;
    this.email = data.email || null;
    this.password = data.password || null;
    this.firstName = data.firstName || data.first_name || null;
    this.lastName = data.lastName || data.last_name || null;
    this.createdAt = data.createdAt || data.created_at || null;
    this.updatedAt = data.updatedAt || data.updated_at || null;
    this.isActive = data.isActive !== undefined ? data.isActive : (data.is_active !== undefined ? Boolean(data.is_active) : true);
    this.lastLoginAt = data.lastLoginAt || data.last_login_at || null;
  }

  /**
   * Validation schema for user registration
   */
  static get registrationSchema() {
    return Joi.object({
      email: Joi.string()
        .email()
        .required()
        .messages({
          'string.email': 'Please provide a valid email address',
          'any.required': 'Email is required'
        }),
      password: Joi.string()
        .min(8)
        .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)'))
        .required()
        .messages({
          'string.min': 'Password must be at least 8 characters long',
          'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
          'any.required': 'Password is required'
        }),
      firstName: Joi.string()
        .min(2)
        .max(50)
        .required()
        .messages({
          'string.min': 'First name must be at least 2 characters long',
          'string.max': 'First name cannot exceed 50 characters',
          'any.required': 'First name is required'
        }),
      lastName: Joi.string()
        .min(2)
        .max(50)
        .required()
        .messages({
          'string.min': 'Last name must be at least 2 characters long',
          'string.max': 'Last name cannot exceed 50 characters',
          'any.required': 'Last name is required'
        })
    });
  }

  /**
   * Validation schema for user login
   */
  static get loginSchema() {
    return Joi.object({
      email: Joi.string()
        .email()
        .required()
        .messages({
          'string.email': 'Please provide a valid email address',
          'any.required': 'Email is required'
        }),
      password: Joi.string()
        .required()
        .messages({
          'any.required': 'Password is required'
        })
    });
  }

  /**
   * Validation schema for profile update
   */
  static get updateSchema() {
    return Joi.object({
      firstName: Joi.string()
        .min(2)
        .max(50)
        .optional()
        .messages({
          'string.min': 'First name must be at least 2 characters long',
          'string.max': 'First name cannot exceed 50 characters'
        }),
      lastName: Joi.string()
        .min(2)
        .max(50)
        .optional()
        .messages({
          'string.min': 'Last name must be at least 2 characters long',
          'string.max': 'Last name cannot exceed 50 characters'
        }),
      email: Joi.string()
        .email()
        .optional()
        .messages({
          'string.email': 'Please provide a valid email address'
        })
    });
  }

  /**
   * Validation schema for password change
   */
  static get passwordChangeSchema() {
    return Joi.object({
      currentPassword: Joi.string()
        .required()
        .messages({
          'any.required': 'Current password is required'
        }),
      newPassword: Joi.string()
        .min(8)
        .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)'))
        .required()
        .messages({
          'string.min': 'New password must be at least 8 characters long',
          'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, and one number',
          'any.required': 'New password is required'
        })
    });
  }

  /**
   * Hash password using bcrypt
   * @param {string} password - Plain text password
   * @returns {Promise<string>} - Hashed password
   */
  static async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Compare password with hash
   * @param {string} password - Plain text password
   * @param {string} hash - Hashed password
   * @returns {Promise<boolean>} - True if password matches
   */
  static async comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Validate user data against schema
   * @param {Object} data - User data to validate
   * @param {Joi.Schema} schema - Joi schema to validate against
   * @returns {Object} - Validation result
   */
  static validate(data, schema) {
    return schema.validate(data, { abortEarly: false });
  }

  /**
   * Convert user instance to plain object (excluding sensitive data)
   * @param {boolean} includeSensitive - Whether to include sensitive data like password
   * @returns {Object} - Plain object representation
   */
  toJSON(includeSensitive = false) {
    const obj = {
      id: this.id,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      isActive: this.isActive,
      lastLoginAt: this.lastLoginAt
    };

    if (includeSensitive) {
      obj.password = this.password;
    }

    return obj;
  }

  /**
   * Convert user instance to database format
   * @returns {Object} - Database format object
   */
  toDatabaseFormat() {
    return {
      id: this.id,
      email: this.email,
      password: this.password,
      first_name: this.firstName,
      last_name: this.lastName,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
      is_active: this.isActive ? 1 : 0,
      last_login_at: this.lastLoginAt
    };
  }

  /**
   * Create User instance from database row
   * @param {Object} row - Database row
   * @returns {User} - User instance
   */
  static fromDatabaseRow(row) {
    if (!row) return null;
    return new User(row);
  }

  /**
   * Get full name
   * @returns {string} - Full name
   */
  getFullName() {
    const firstName = this.firstName || '';
    const lastName = this.lastName || '';
    return `${firstName} ${lastName}`.trim();
  }

  /**
   * Check if user is active
   * @returns {boolean} - True if user is active
   */
  isUserActive() {
    return Boolean(this.isActive);
  }

  /**
   * Update last login timestamp
   */
  updateLastLogin() {
    this.lastLoginAt = new Date().toISOString();
  }
}

module.exports = User;