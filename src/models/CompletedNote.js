const Joi = require('joi');

/**
 * CompletedNote Model
 * Represents a completed note stored in history
 */
class CompletedNote {
  constructor(data = {}) {
    this.id = data.id || null;
    this.userId = data.userId || data.user_id || null;
    this.originalNoteId = data.originalNoteId || data.original_note_id || null;
    this.title = data.title || '';
    this.description = data.description || '';
    this.groupName = data.groupName || data.group_name || null;
    this.priority = data.priority || 'medium';
    this.completedAt = data.completedAt || data.completed_at || null;
    this.createdAt = data.createdAt || data.created_at || null;
  }

  /**
   * Validation schema for completed note creation
   */
  static get createSchema() {
    return Joi.object({
      id: Joi.string().allow(null).optional(),
      userId: Joi.string().required(),
      originalNoteId: Joi.string().required(),
      title: Joi.string().min(1).max(255).required(),
      description: Joi.string().allow('').max(2000),
      groupName: Joi.string().allow(null).max(100),
      priority: Joi.string().valid('low', 'medium', 'high').required(),
      completedAt: Joi.date().required(),
      createdAt: Joi.date().required()
    });
  }

  /**
   * Validation schema for completed note queries
   */
  static get querySchema() {
    return Joi.object({
      userId: Joi.string().required(),
      startDate: Joi.date().optional(),
      endDate: Joi.date().optional(),
      priority: Joi.string().valid('low', 'medium', 'high').optional(),
      groupName: Joi.string().optional(),
      limit: Joi.number().integer().min(1).max(100).default(50),
      offset: Joi.number().integer().min(0).default(0)
    });
  }

  /**
   * Validate completed note data for creation
   */
  static validateCreate(data) {
    return this.createSchema.validate(data, { abortEarly: false });
  }

  /**
   * Validate query parameters
   */
  static validateQuery(data) {
    return this.querySchema.validate(data, { abortEarly: false });
  }

  /**
   * Convert to database format
   */
  toDatabase() {
    return {
      id: this.id,
      user_id: this.userId,
      original_note_id: this.originalNoteId,
      title: this.title,
      description: this.description,
      group_name: this.groupName,
      priority: this.priority,
      completed_at: this.completedAt,
      created_at: this.createdAt
    };
  }

  /**
   * Convert to API response format
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      originalNoteId: this.originalNoteId,
      title: this.title,
      description: this.description,
      groupName: this.groupName,
      priority: this.priority,
      completedAt: this.completedAt,
      createdAt: this.createdAt
    };
  }

  /**
   * Create CompletedNote from Note instance
   */
  static fromNote(note, groupName = null) {
    return new CompletedNote({
      userId: note.userId,
      originalNoteId: note.id,
      title: note.title,
      description: note.description,
      groupName: groupName,
      priority: note.priority,
      completedAt: note.completedAt || new Date().toISOString(),
      createdAt: note.createdAt
    });
  }

  /**
   * Get priority color for UI
   */
  getPriorityColor() {
    const colors = {
      high: '#e74c3c',    // Red
      medium: '#f39c12',  // Yellow/Orange
      low: '#27ae60'      // Green
    };
    return colors[this.priority] || colors.medium;
  }

  /**
   * Get formatted completion date
   */
  getFormattedCompletedDate() {
    if (!this.completedAt) return null;
    
    const date = new Date(this.completedAt);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Check if completed today
   */
  isCompletedToday() {
    if (!this.completedAt) return false;
    
    const today = new Date();
    const completedDate = new Date(this.completedAt);
    
    return today.toDateString() === completedDate.toDateString();
  }

  /**
   * Check if completed in date range
   */
  isCompletedInRange(startDate, endDate) {
    if (!this.completedAt) return false;
    
    const completedDate = new Date(this.completedAt);
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return completedDate >= start && completedDate <= end;
  }
}

module.exports = CompletedNote;