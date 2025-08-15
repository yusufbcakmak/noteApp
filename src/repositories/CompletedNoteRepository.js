const dbConnection = require('../config/database');
const CompletedNote = require('../models/CompletedNote');

/**
 * CompletedNote Repository
 * Handles database operations for completed notes (history)
 */
class CompletedNoteRepository {
  constructor() {
    this.db = null;
  }

  /**
   * Initialize repository with database connection
   */
  initialize() {
    this.db = dbConnection.getDatabase();
  }

  /**
   * Create a new completed note record
   */
  async create(completedNoteData) {
    if (!this.db) this.initialize();

    const completedNote = new CompletedNote(completedNoteData);
    const { error } = CompletedNote.validateCreate(completedNote);
    
    if (error) {
      throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
    }

    const data = completedNote.toDatabase();
    
    // Generate ID if not provided
    if (!data.id) {
      data.id = require('crypto').randomBytes(16).toString('hex');
    }

    const stmt = this.db.prepare(`
      INSERT INTO completed_notes (
        id, user_id, original_note_id, title, description, 
        group_name, priority, completed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      const result = stmt.run(
        data.id,
        data.user_id,
        data.original_note_id,
        data.title,
        data.description,
        data.group_name,
        data.priority,
        data.completed_at,
        data.created_at
      );

      if (result.changes === 0) {
        throw new Error('Failed to create completed note');
      }

      return this.findById(data.id);
    } catch (error) {
      if (error.message && error.message.includes('UNIQUE constraint failed')) {
        throw new Error('Completed note with this ID already exists');
      }
      throw error;
    }
  }

  /**
   * Find completed note by ID
   */
  async findById(id) {
    if (!this.db) this.initialize();

    const stmt = this.db.prepare(`
      SELECT * FROM completed_notes WHERE id = ?
    `);

    const row = stmt.get(id);
    return row ? new CompletedNote(row) : null;
  }

  /**
   * Find all completed notes for a user with optional filtering
   */
  async findByUserId(userId, options = {}) {
    if (!this.db) this.initialize();

    const {
      startDate,
      endDate,
      priority,
      groupName,
      limit = 50,
      offset = 0,
      orderBy = 'completed_at',
      orderDirection = 'DESC'
    } = options;

    let query = `
      SELECT * FROM completed_notes 
      WHERE user_id = ?
    `;
    const params = [userId];

    // Add date filtering
    if (startDate) {
      query += ` AND completed_at >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND completed_at <= ?`;
      params.push(endDate);
    }

    // Add priority filtering
    if (priority) {
      query += ` AND priority = ?`;
      params.push(priority);
    }

    // Add group filtering
    if (groupName) {
      query += ` AND group_name = ?`;
      params.push(groupName);
    }

    // Add ordering
    const validOrderBy = ['completed_at', 'created_at', 'title', 'priority'];
    const validDirection = ['ASC', 'DESC'];
    
    if (validOrderBy.includes(orderBy) && validDirection.includes(orderDirection.toUpperCase())) {
      query += ` ORDER BY ${orderBy} ${orderDirection.toUpperCase()}`;
    } else {
      query += ` ORDER BY completed_at DESC`;
    }

    // Add pagination
    query += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params);

    return rows.map(row => new CompletedNote(row));
  }

  /**
   * Get completed notes count for a user with optional filtering
   */
  async countByUserId(userId, options = {}) {
    if (!this.db) this.initialize();

    const { startDate, endDate, priority, groupName } = options;

    let query = `
      SELECT COUNT(*) as count FROM completed_notes 
      WHERE user_id = ?
    `;
    const params = [userId];

    // Add date filtering
    if (startDate) {
      query += ` AND completed_at >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND completed_at <= ?`;
      params.push(endDate);
    }

    // Add priority filtering
    if (priority) {
      query += ` AND priority = ?`;
      params.push(priority);
    }

    // Add group filtering
    if (groupName) {
      query += ` AND group_name = ?`;
      params.push(groupName);
    }

    const stmt = this.db.prepare(query);
    const result = stmt.get(...params);

    return result.count;
  }

  /**
   * Get daily completion statistics for a user
   */
  async getDailyStats(userId, options = {}) {
    if (!this.db) this.initialize();

    const {
      startDate,
      endDate,
      limit = 30
    } = options;

    let query = `
      SELECT 
        DATE(completed_at) as date,
        COUNT(*) as count,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority,
        COUNT(CASE WHEN priority = 'medium' THEN 1 END) as medium_priority,
        COUNT(CASE WHEN priority = 'low' THEN 1 END) as low_priority
      FROM completed_notes 
      WHERE user_id = ?
    `;
    const params = [userId];

    // Add date filtering
    if (startDate) {
      query += ` AND completed_at >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND completed_at <= ?`;
      params.push(endDate);
    }

    query += `
      GROUP BY DATE(completed_at)
      ORDER BY date DESC
      LIMIT ?
    `;
    params.push(limit);

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params);

    return rows.map(row => ({
      date: row.date,
      count: row.count,
      priorityBreakdown: {
        high: row.high_priority,
        medium: row.medium_priority,
        low: row.low_priority
      }
    }));
  }

  /**
   * Get completion statistics by priority for a user
   */
  async getPriorityStats(userId, options = {}) {
    if (!this.db) this.initialize();

    const { startDate, endDate } = options;

    let query = `
      SELECT 
        priority,
        COUNT(*) as count
      FROM completed_notes 
      WHERE user_id = ?
    `;
    const params = [userId];

    // Add date filtering
    if (startDate) {
      query += ` AND completed_at >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND completed_at <= ?`;
      params.push(endDate);
    }

    query += `
      GROUP BY priority
      ORDER BY 
        CASE priority 
          WHEN 'high' THEN 1 
          WHEN 'medium' THEN 2 
          WHEN 'low' THEN 3 
        END
    `;

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params);

    return rows.reduce((acc, row) => {
      acc[row.priority] = row.count;
      return acc;
    }, { high: 0, medium: 0, low: 0 });
  }

  /**
   * Get completion statistics by group for a user
   */
  async getGroupStats(userId, options = {}) {
    if (!this.db) this.initialize();

    const { startDate, endDate, limit = 10 } = options;

    let query = `
      SELECT 
        COALESCE(group_name, 'Ungrouped') as group_name,
        COUNT(*) as count
      FROM completed_notes 
      WHERE user_id = ?
    `;
    const params = [userId];

    // Add date filtering
    if (startDate) {
      query += ` AND completed_at >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND completed_at <= ?`;
      params.push(endDate);
    }

    query += `
      GROUP BY group_name
      ORDER BY count DESC
      LIMIT ?
    `;
    params.push(limit);

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params);

    return rows.map(row => ({
      groupName: row.group_name,
      count: row.count
    }));
  }

  /**
   * Delete completed note by ID
   */
  async deleteById(id) {
    if (!this.db) this.initialize();

    const stmt = this.db.prepare(`
      DELETE FROM completed_notes WHERE id = ?
    `);

    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Delete all completed notes for a user
   */
  async deleteByUserId(userId) {
    if (!this.db) this.initialize();

    const stmt = this.db.prepare(`
      DELETE FROM completed_notes WHERE user_id = ?
    `);

    const result = stmt.run(userId);
    return result.changes;
  }

  /**
   * Get recent completed notes for a user
   */
  async getRecent(userId, limit = 10) {
    if (!this.db) this.initialize();

    const stmt = this.db.prepare(`
      SELECT * FROM completed_notes 
      WHERE user_id = ?
      ORDER BY completed_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(userId, limit);
    return rows.map(row => new CompletedNote(row));
  }

  /**
   * Check if original note already exists in history
   */
  async existsByOriginalNoteId(originalNoteId) {
    if (!this.db) this.initialize();

    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM completed_notes 
      WHERE original_note_id = ?
    `);

    const result = stmt.get(originalNoteId);
    return result.count > 0;
  }
}

module.exports = CompletedNoteRepository;