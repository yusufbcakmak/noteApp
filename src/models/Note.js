const Joi = require('joi');

/**
 * Note model with validation and business logic
 */
class Note {
  constructor(data = {}) {
    this.id = data.id || null;
    this.userId = data.userId || data.user_id || null;
    this.groupId = data.groupId || data.group_id || null;
    this.title = data.title || null;
    this.description = data.description || null;
    this.status = data.status || 'todo';
    this.priority = data.priority || 'medium';
    this.createdAt = data.createdAt || data.created_at || null;
    this.updatedAt = data.updatedAt || data.updated_at || null;
    this.completedAt = data.completedAt || data.completed_at || null;
  }

  /**
   * Valid status values
   */
  static get STATUSES() {
    return ['todo', 'in_progress', 'done', 'archived'];
  }

  /**
   * Valid priority values
   */
  static get PRIORITIES() {
    return ['low', 'medium', 'high'];
  }

  /**
   * Priority colors mapping
   */
  static get PRIORITY_COLORS() {
    return {
      low: '#28a745',    // Green
      medium: '#ffc107', // Yellow
      high: '#dc3545'    // Red
    };
  }

  /**
   * Validation schema for note creation
   */
  static get createSchema() {
    return Joi.object({
      userId: Joi.string()
        .required()
        .messages({
          'any.required': 'User ID is required'
        }),
      title: Joi.string()
        .min(1)
        .max(255)
        .required()
        .messages({
          'string.min': 'Title cannot be empty',
          'string.empty': 'Title cannot be empty',
          'string.max': 'Title cannot exceed 255 characters',
          'any.required': 'Title is required'
        }),
      description: Joi.string()
        .max(2000)
        .allow('')
        .optional()
        .messages({
          'string.max': 'Description cannot exceed 2000 characters'
        }),
      groupId: Joi.string()
        .pattern(/^[a-f0-9]{32}$/)
        .optional()
        .allow(null, '')
        .messages({
          'string.base': 'Group ID must be a string',
          'string.pattern.base': 'Group ID must be a valid 32-character hex string'
        }),
      priority: Joi.string()
        .valid(...Note.PRIORITIES)
        .default('medium')
        .messages({
          'any.only': `Priority must be one of: ${Note.PRIORITIES.join(', ')}`
        }),
      status: Joi.string()
        .valid(...Note.STATUSES)
        .default('todo')
        .messages({
          'any.only': `Status must be one of: ${Note.STATUSES.join(', ')}`
        })
    });
  }

  /**
   * Validation schema for note update
   */
  static get updateSchema() {
    return Joi.object({
      title: Joi.string()
        .min(1)
        .max(255)
        .optional()
        .messages({
          'string.min': 'Title cannot be empty',
          'string.empty': 'Title cannot be empty',
          'string.max': 'Title cannot exceed 255 characters'
        }),
      description: Joi.string()
        .max(2000)
        .allow('')
        .optional()
        .messages({
          'string.max': 'Description cannot exceed 2000 characters'
        }),
      groupId: Joi.string()
        .pattern(/^[a-f0-9]{32}$/)
        .optional()
        .allow(null, '')
        .messages({
          'string.base': 'Group ID must be a string',
          'string.pattern.base': 'Group ID must be a valid 32-character hex string'
        }),
      priority: Joi.string()
        .valid(...Note.PRIORITIES)
        .optional()
        .messages({
          'any.only': `Priority must be one of: ${Note.PRIORITIES.join(', ')}`
        }),
      status: Joi.string()
        .valid(...Note.STATUSES)
        .optional()
        .messages({
          'any.only': `Status must be one of: ${Note.STATUSES.join(', ')}`
        })
    });
  }

  /**
   * Validation schema for status update
   */
  static get statusUpdateSchema() {
    return Joi.object({
      status: Joi.string()
        .valid(...Note.STATUSES)
        .required()
        .messages({
          'any.only': `Status must be one of: ${Note.STATUSES.join(', ')}`,
          'any.required': 'Status is required'
        })
    });
  }

  /**
   * Validate note data against schema
   * @param {Object} data - Note data to validate
   * @param {Joi.Schema} schema - Joi schema to validate against
   * @returns {Object} - Validation result
   */
  static validate(data, schema) {
    return schema.validate(data, { abortEarly: false });
  }

  /**
   * Check if status transition is valid
   * @param {string} fromStatus - Current status
   * @param {string} toStatus - Target status
   * @returns {boolean} - True if transition is valid
   */
  static isValidStatusTransition(fromStatus, toStatus) {
    // All transitions are allowed for flexibility
    // Business logic can be added here if needed
    return Note.STATUSES.includes(fromStatus) && Note.STATUSES.includes(toStatus);
  }

  /**
   * Get priority color
   * @param {string} priority - Priority level
   * @returns {string} - Color hex code
   */
  static getPriorityColor(priority) {
    return Note.PRIORITY_COLORS[priority] || Note.PRIORITY_COLORS.medium;
  }

  /**
   * Convert note instance to plain object
   * @returns {Object} - Plain object representation
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      groupId: this.groupId,
      title: this.title,
      description: this.description,
      status: this.status,
      priority: this.priority,
      priorityColor: Note.getPriorityColor(this.priority),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      completedAt: this.completedAt
    };
  }

  /**
   * Convert note instance to database format
   * @returns {Object} - Database format object
   */
  toDatabaseFormat() {
    return {
      id: this.id,
      user_id: this.userId,
      group_id: this.groupId,
      title: this.title,
      description: this.description,
      status: this.status,
      priority: this.priority,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
      completed_at: this.completedAt
    };
  }

  /**
   * Create Note instance from database row
   * @param {Object} row - Database row
   * @returns {Note} - Note instance
   */
  static fromDatabaseRow(row) {
    if (!row) return null;
    return new Note(row);
  }

  /**
   * Check if note is completed
   * @returns {boolean} - True if note is completed
   */
  isCompleted() {
    return this.status === 'done';
  }

  /**
   * Check if note is in progress
   * @returns {boolean} - True if note is in progress
   */
  isInProgress() {
    return this.status === 'in_progress';
  }

  /**
   * Check if note is todo
   * @returns {boolean} - True if note is todo
   */
  isTodo() {
    return this.status === 'todo';
  }

  /**
   * Check if note has high priority
   * @returns {boolean} - True if note has high priority
   */
  isHighPriority() {
    return this.priority === 'high';
  }

  /**
   * Check if note has medium priority
   * @returns {boolean} - True if note has medium priority
   */
  isMediumPriority() {
    return this.priority === 'medium';
  }

  /**
   * Check if note has low priority
   * @returns {boolean} - True if note has low priority
   */
  isLowPriority() {
    return this.priority === 'low';
  }

  /**
   * Update status and set completion timestamp if needed
   * @param {string} newStatus - New status
   */
  updateStatus(newStatus) {
    if (!Note.STATUSES.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }

    const oldStatus = this.status;
    this.status = newStatus;
    this.updatedAt = new Date().toISOString();

    // Set completion timestamp when moving to done
    if (newStatus === 'done' && oldStatus !== 'done') {
      this.completedAt = new Date().toISOString();
    }
    
    // Clear completion timestamp when moving away from done
    if (newStatus !== 'done' && oldStatus === 'done') {
      this.completedAt = null;
    }
  }

  /**
   * Update priority
   * @param {string} newPriority - New priority
   */
  updatePriority(newPriority) {
    if (!Note.PRIORITIES.includes(newPriority)) {
      throw new Error(`Invalid priority: ${newPriority}`);
    }

    this.priority = newPriority;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Get formatted creation date
   * @returns {string} - Formatted date
   */
  getFormattedCreatedAt() {
    if (!this.createdAt) return '';
    return new Date(this.createdAt).toLocaleDateString();
  }

  /**
   * Get formatted completion date
   * @returns {string} - Formatted date
   */
  getFormattedCompletedAt() {
    if (!this.completedAt) return '';
    return new Date(this.completedAt).toLocaleDateString();
  }

  /**
   * Get time since creation
   * @returns {string} - Time since creation
   */
  getTimeSinceCreation() {
    if (!this.createdAt) return '';
    
    const now = new Date();
    const created = new Date(this.createdAt);
    const diffMs = now - created;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  }
}

module.exports = Note;