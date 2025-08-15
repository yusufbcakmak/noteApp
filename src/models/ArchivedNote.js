const Joi = require('joi');

/**
 * ArchivedNote model for archived completed notes
 */
class ArchivedNote {
  constructor(data = {}) {
    this.id = data.id || null;
    this.userId = data.userId || data.user_id || null;
    this.originalNoteId = data.originalNoteId || data.original_note_id || null;
    this.title = data.title || null;
    this.description = data.description || null;
    this.priority = data.priority || 'medium';
    this.groupName = data.groupName || data.group_name || null;
    this.completedAt = data.completedAt || data.completed_at || null;
    this.archivedAt = data.archivedAt || data.archived_at || null;
    this.createdAt = data.createdAt || data.created_at || null;
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
   * Validation schema for archived note creation
   */
  static get createSchema() {
    return Joi.object({
      userId: Joi.string()
        .required()
        .messages({
          'any.required': 'User ID is required'
        }),
      originalNoteId: Joi.string()
        .required()
        .messages({
          'any.required': 'Original note ID is required'
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
      priority: Joi.string()
        .valid(...ArchivedNote.PRIORITIES)
        .default('medium')
        .messages({
          'any.only': `Priority must be one of: ${ArchivedNote.PRIORITIES.join(', ')}`
        }),
      groupName: Joi.string()
        .max(100)
        .allow('')
        .optional()
        .messages({
          'string.max': 'Group name cannot exceed 100 characters'
        }),
      completedAt: Joi.date()
        .iso()
        .required()
        .messages({
          'any.required': 'Completed date is required',
          'date.format': 'Completed date must be in ISO format'
        }),
      createdAt: Joi.date()
        .iso()
        .required()
        .messages({
          'any.required': 'Created date is required',
          'date.format': 'Created date must be in ISO format'
        })
    });
  }

  /**
   * Validate archived note data against schema
   * @param {Object} data - Archived note data to validate
   * @param {Joi.Schema} schema - Joi schema to validate against
   * @returns {Object} - Validation result
   */
  static validate(data, schema) {
    return schema.validate(data, { abortEarly: false });
  }

  /**
   * Get priority color
   * @param {string} priority - Priority level
   * @returns {string} - Color hex code
   */
  static getPriorityColor(priority) {
    return ArchivedNote.PRIORITY_COLORS[priority] || ArchivedNote.PRIORITY_COLORS.medium;
  }

  /**
   * Convert archived note instance to plain object
   * @returns {Object} - Plain object representation
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      originalNoteId: this.originalNoteId,
      title: this.title,
      description: this.description,
      priority: this.priority,
      priorityColor: ArchivedNote.getPriorityColor(this.priority),
      groupName: this.groupName,
      completedAt: this.completedAt,
      archivedAt: this.archivedAt,
      createdAt: this.createdAt
    };
  }

  /**
   * Convert archived note instance to database format
   * @returns {Object} - Database format object
   */
  toDatabaseFormat() {
    return {
      id: this.id,
      user_id: this.userId,
      original_note_id: this.originalNoteId,
      title: this.title,
      description: this.description,
      priority: this.priority,
      group_name: this.groupName,
      completed_at: this.completedAt,
      archived_at: this.archivedAt,
      created_at: this.createdAt
    };
  }

  /**
   * Create ArchivedNote instance from database row
   * @param {Object} row - Database row
   * @returns {ArchivedNote} - ArchivedNote instance
   */
  static fromDatabaseRow(row) {
    if (!row) return null;
    return new ArchivedNote(row);
  }

  /**
   * Create ArchivedNote from regular Note
   * @param {Note} note - Note instance
   * @param {string} groupName - Group name (optional)
   * @returns {ArchivedNote} - ArchivedNote instance
   */
  static fromNote(note, groupName = null) {
    return new ArchivedNote({
      userId: note.userId,
      originalNoteId: note.id,
      title: note.title,
      description: note.description,
      priority: note.priority,
      groupName: groupName,
      completedAt: note.completedAt || new Date().toISOString(),
      archivedAt: new Date().toISOString(),
      createdAt: note.createdAt
    });
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
   * Get formatted completion date
   * @returns {string} - Formatted date
   */
  getFormattedCompletedAt() {
    if (!this.completedAt) return '';
    return new Date(this.completedAt).toLocaleDateString();
  }

  /**
   * Get formatted archive date
   * @returns {string} - Formatted date
   */
  getFormattedArchivedAt() {
    if (!this.archivedAt) return '';
    return new Date(this.archivedAt).toLocaleDateString();
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
   * Get time since archived
   * @returns {string} - Time since archived
   */
  getTimeSinceArchived() {
    if (!this.archivedAt) return '';
    
    const now = new Date();
    const archived = new Date(this.archivedAt);
    const diffMs = now - archived;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  }
}

module.exports = ArchivedNote;
