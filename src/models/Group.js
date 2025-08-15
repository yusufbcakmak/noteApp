const Joi = require('joi');

/**
 * Group model with validation and business logic
 */
class Group {
  constructor(data = {}) {
    this.id = data.id || null;
    this.userId = data.userId || data.user_id || null;
    this.name = data.name || null;
    this.description = data.description || null;
    this.color = data.color || '#3498db';
    this.createdAt = data.createdAt || data.created_at || null;
    this.updatedAt = data.updatedAt || data.updated_at || null;
  }

  /**
   * Validation schema for group creation
   */
  static get creationSchema() {
    return Joi.object({
      userId: Joi.string()
        .required()
        .messages({
          'any.required': 'User ID is required'
        }),
      name: Joi.string()
        .min(1)
        .max(100)
        .required()
        .messages({
          'string.min': 'Group name must be at least 1 character long',
          'string.max': 'Group name cannot exceed 100 characters',
          'string.empty': 'Group name must be at least 1 character long',
          'any.required': 'Group name is required'
        }),
      description: Joi.string()
        .max(500)
        .optional()
        .allow('')
        .messages({
          'string.max': 'Description cannot exceed 500 characters'
        }),
      color: Joi.string()
        .pattern(/^#[0-9A-Fa-f]{6}$/)
        .optional()
        .messages({
          'string.pattern.base': 'Color must be a valid hex color code (e.g., #3498db)'
        })
    });
  }

  /**
   * Validation schema for group update
   */
  static get updateSchema() {
    return Joi.object({
      name: Joi.string()
        .min(1)
        .max(100)
        .optional()
        .messages({
          'string.min': 'Group name must be at least 1 character long',
          'string.max': 'Group name cannot exceed 100 characters',
          'string.empty': 'Group name must be at least 1 character long'
        }),
      description: Joi.string()
        .max(500)
        .optional()
        .allow('')
        .messages({
          'string.max': 'Description cannot exceed 500 characters'
        }),
      color: Joi.string()
        .pattern(/^#[0-9A-Fa-f]{6}$/)
        .optional()
        .messages({
          'string.pattern.base': 'Color must be a valid hex color code (e.g., #3498db)'
        })
    });
  }

  /**
   * Validate group data against schema
   * @param {Object} data - Group data to validate
   * @param {Joi.Schema} schema - Joi schema to validate against
   * @returns {Object} - Validation result
   */
  static validate(data, schema) {
    return schema.validate(data, { abortEarly: false });
  }

  /**
   * Convert group instance to plain object
   * @returns {Object} - Plain object representation
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      name: this.name,
      description: this.description,
      color: this.color,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Convert group instance to database format
   * @returns {Object} - Database format object
   */
  toDatabaseFormat() {
    return {
      id: this.id,
      user_id: this.userId,
      name: this.name,
      description: this.description,
      color: this.color,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  /**
   * Create Group instance from database row
   * @param {Object} row - Database row
   * @returns {Group} - Group instance
   */
  static fromDatabaseRow(row) {
    if (!row) return null;
    return new Group(row);
  }

  /**
   * Check if group belongs to user
   * @param {string} userId - User ID to check
   * @returns {boolean} - True if group belongs to user
   */
  belongsToUser(userId) {
    return this.userId === userId;
  }

  /**
   * Update group properties
   * @param {Object} updates - Properties to update
   */
  update(updates) {
    if (updates.name !== undefined) this.name = updates.name;
    if (updates.description !== undefined) this.description = updates.description;
    if (updates.color !== undefined) this.color = updates.color;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Get default color options
   * @returns {Array} - Array of default color options
   */
  static getDefaultColors() {
    return [
      '#3498db', // Blue
      '#e74c3c', // Red
      '#2ecc71', // Green
      '#f39c12', // Orange
      '#9b59b6', // Purple
      '#1abc9c', // Turquoise
      '#34495e', // Dark Gray
      '#e67e22', // Carrot
      '#95a5a6', // Silver
      '#f1c40f'  // Yellow
    ];
  }

  /**
   * Validate color code
   * @param {string} color - Color code to validate
   * @returns {boolean} - True if valid hex color
   */
  static isValidColor(color) {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
  }
}

module.exports = Group;