const ArchivedNote = require('../models/ArchivedNote');
const dbConnection = require('../config/database');

/**
 * ArchivedNote repository for database operations
 */
class ArchivedNoteRepository {
  constructor() {
    this.db = null;
  }

  /**
   * Initialize repository with database connection
   */
  init() {
    this.db = dbConnection.getDatabase();
    this._ensureTable();
    return this;
  }

  /**
   * Ensure archived_notes table exists
   * @private
   */
  _ensureTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS archived_notes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        original_note_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        priority TEXT NOT NULL DEFAULT 'medium',
        group_name TEXT,
        completed_at TEXT NOT NULL,
        archived_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `;

    this.db.exec(createTableQuery);

    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_archived_notes_user_id ON archived_notes(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_archived_notes_archived_at ON archived_notes(archived_at)',
      'CREATE INDEX IF NOT EXISTS idx_archived_notes_priority ON archived_notes(priority)',
      'CREATE INDEX IF NOT EXISTS idx_archived_notes_original_note_id ON archived_notes(original_note_id)'
    ];

    indexes.forEach(indexQuery => {
      this.db.exec(indexQuery);
    });
  }

  /**
   * Archive a completed note
   * @param {Note} note - Note to archive
   * @param {string} groupName - Group name (optional)
   * @returns {Promise<ArchivedNote>} - Archived note
   */
  async archive(note, groupName = null) {
    try {
      // Check if note is already archived
      const existingArchive = await this.findByOriginalNoteId(note.id, note.userId);
      if (existingArchive) {
        return existingArchive; // Already archived
      }

      // Create archived note from regular note
      const archivedNote = ArchivedNote.fromNote(note, groupName);
      
      // Generate ID if not provided
      if (!archivedNote.id) {
        archivedNote.id = this._generateId();
      }

      const dbData = archivedNote.toDatabaseFormat();

      const query = `
        INSERT INTO archived_notes (
          id, user_id, original_note_id, title, description, 
          priority, group_name, completed_at, archived_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        dbData.id,
        dbData.user_id,
        dbData.original_note_id,
        dbData.title,
        dbData.description,
        dbData.priority,
        dbData.group_name,
        dbData.completed_at,
        dbData.archived_at,
        dbData.created_at
      ];

      const result = this.db.prepare(query).run(params);

      if (result.changes === 0) {
        throw new Error('Failed to archive note');
      }

      return this.findById(archivedNote.id);
    } catch (error) {
      throw new Error(`Failed to archive note: ${error.message}`);
    }
  }

  /**
   * Find archived note by ID
   * @param {string} id - Archived note ID
   * @returns {Promise<ArchivedNote|null>} - Archived note or null if not found
   */
  async findById(id) {
    try {
      const query = 'SELECT * FROM archived_notes WHERE id = ?';
      const row = this.db.prepare(query).get(id);
      return ArchivedNote.fromDatabaseRow(row);
    } catch (error) {
      throw new Error(`Failed to find archived note by ID: ${error.message}`);
    }
  }

  /**
   * Find archived note by original note ID
   * @param {string} originalNoteId - Original note ID
   * @param {string} userId - User ID
   * @returns {Promise<ArchivedNote|null>} - Archived note or null if not found
   */
  async findByOriginalNoteId(originalNoteId, userId) {
    try {
      const query = 'SELECT * FROM archived_notes WHERE original_note_id = ? AND user_id = ?';
      const row = this.db.prepare(query).get(originalNoteId, userId);
      return ArchivedNote.fromDatabaseRow(row);
    } catch (error) {
      throw new Error(`Failed to find archived note by original note ID: ${error.message}`);
    }
  }

  /**
   * Find archived note by ID and user ID (for authorization)
   * @param {string} id - Archived note ID
   * @param {string} userId - User ID
   * @returns {Promise<ArchivedNote|null>} - Archived note or null if not found
   */
  async findByIdAndUserId(id, userId) {
    try {
      const query = 'SELECT * FROM archived_notes WHERE id = ? AND user_id = ?';
      const row = this.db.prepare(query).get(id, userId);
      return ArchivedNote.fromDatabaseRow(row);
    } catch (error) {
      throw new Error(`Failed to find archived note by ID and user ID: ${error.message}`);
    }
  }

  /**
   * Find all archived notes for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<ArchivedNote[]>} - Array of archived notes
   */
  async findByUserId(userId, options = {}) {
    try {
      const {
        priority,
        groupName,
        search,
        sortBy = 'archived_at',
        sortOrder = 'DESC',
        limit,
        offset = 0
      } = options;

      let whereClause = 'WHERE user_id = ?';
      const params = [userId];

      // Add filters
      if (priority) {
        whereClause += ' AND priority = ?';
        params.push(priority);
      }

      if (groupName) {
        whereClause += ' AND group_name = ?';
        params.push(groupName);
      }

      if (search) {
        whereClause += ' AND (title LIKE ? OR description LIKE ?)';
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern);
      }

      // Build query
      let query = `SELECT * FROM archived_notes ${whereClause}`;

      // Add sorting
      const validSortColumns = ['archived_at', 'completed_at', 'created_at', 'title', 'priority'];
      const validSortOrders = ['ASC', 'DESC'];
      
      if (validSortColumns.includes(sortBy) && validSortOrders.includes(sortOrder.toUpperCase())) {
        query += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;
      }

      // Add pagination
      if (limit) {
        query += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);
      }

      const rows = this.db.prepare(query).all(params);
      return rows.map(row => ArchivedNote.fromDatabaseRow(row));
    } catch (error) {
      throw new Error(`Failed to find archived notes by user ID: ${error.message}`);
    }
  }

  /**
   * Find archived notes with pagination
   * @param {string} userId - User ID
   * @param {Object} options - Pagination and filter options
   * @returns {Promise<Object>} - Archived notes with pagination info
   */
  async findWithPagination(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        priority,
        groupName,
        search,
        sortBy = 'archived_at',
        sortOrder = 'DESC'
      } = options;

      const offset = (page - 1) * limit;

      let whereClause = 'WHERE user_id = ?';
      const params = [userId];

      // Add filters
      if (priority) {
        whereClause += ' AND priority = ?';
        params.push(priority);
      }

      if (groupName) {
        whereClause += ' AND group_name = ?';
        params.push(groupName);
      }

      if (search) {
        whereClause += ' AND (title LIKE ? OR description LIKE ?)';
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern);
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) as count FROM archived_notes ${whereClause}`;
      const countResult = this.db.prepare(countQuery).get(params);
      const total = countResult.count;

      // Get archived notes
      const validSortColumns = ['archived_at', 'completed_at', 'created_at', 'title', 'priority'];
      const validSortOrders = ['ASC', 'DESC'];
      
      let notesQuery = `SELECT * FROM archived_notes ${whereClause}`;
      
      if (validSortColumns.includes(sortBy) && validSortOrders.includes(sortOrder.toUpperCase())) {
        notesQuery += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;
      }
      
      notesQuery += ' LIMIT ? OFFSET ?';
      const notesParams = [...params, limit, offset];
      
      const rows = this.db.prepare(notesQuery).all(notesParams);
      const archivedNotes = rows.map(row => ArchivedNote.fromDatabaseRow(row));

      return {
        archivedNotes,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      };
    } catch (error) {
      throw new Error(`Failed to find archived notes with pagination: ${error.message}`);
    }
  }

  /**
   * Delete an archived note
   * @param {string} id - Archived note ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<boolean>} - True if deleted successfully
   */
  async delete(id, userId) {
    try {
      const query = 'DELETE FROM archived_notes WHERE id = ? AND user_id = ?';
      const result = this.db.prepare(query).run(id, userId);
      return result.changes > 0;
    } catch (error) {
      throw new Error(`Failed to delete archived note: ${error.message}`);
    }
  }

  /**
   * Get archived notes count by priority for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Priority counts
   */
  async getPriorityCounts(userId) {
    try {
      const query = `
        SELECT 
          priority,
          COUNT(*) as count
        FROM archived_notes 
        WHERE user_id = ?
        GROUP BY priority
      `;

      const rows = this.db.prepare(query).all(userId);
      
      const counts = {
        low: 0,
        medium: 0,
        high: 0,
        total: 0
      };

      rows.forEach(row => {
        counts[row.priority] = row.count;
        counts.total += row.count;
      });

      return counts;
    } catch (error) {
      throw new Error(`Failed to get archived note priority counts: ${error.message}`);
    }
  }

  /**
   * Get archived notes count by group for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Group counts
   */
  async getGroupCounts(userId) {
    try {
      const query = `
        SELECT 
          COALESCE(group_name, 'Ungrouped') as group_name,
          COUNT(*) as count
        FROM archived_notes 
        WHERE user_id = ?
        GROUP BY group_name
        ORDER BY count DESC
      `;

      const rows = this.db.prepare(query).all(userId);
      
      const counts = {};
      let total = 0;

      rows.forEach(row => {
        counts[row.group_name] = row.count;
        total += row.count;
      });

      return { ...counts, total };
    } catch (error) {
      throw new Error(`Failed to get archived note group counts: ${error.message}`);
    }
  }

  /**
   * Get recent archived notes for a user
   * @param {string} userId - User ID
   * @param {number} limit - Number of notes to return
   * @returns {Promise<ArchivedNote[]>} - Array of recent archived notes
   */
  async getRecentArchived(userId, limit = 5) {
    try {
      const query = `
        SELECT * FROM archived_notes 
        WHERE user_id = ?
        ORDER BY archived_at DESC
        LIMIT ?
      `;

      const rows = this.db.prepare(query).all(userId, limit);
      return rows.map(row => ArchivedNote.fromDatabaseRow(row));
    } catch (error) {
      throw new Error(`Failed to get recent archived notes: ${error.message}`);
    }
  }

  /**
   * Check if a note is already archived
   * @param {string} originalNoteId - Original note ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - True if archived
   */
  async isNoteArchived(originalNoteId, userId) {
    try {
      const query = 'SELECT COUNT(*) as count FROM archived_notes WHERE original_note_id = ? AND user_id = ?';
      const result = this.db.prepare(query).get(originalNoteId, userId);
      return result.count > 0;
    } catch (error) {
      throw new Error(`Failed to check if note is archived: ${error.message}`);
    }
  }

  /**
   * Generate a unique ID for archived note
   * @returns {string} - Generated ID
   * @private
   */
  _generateId() {
    // Generate a random hex string (similar to SQLite's hex(randomblob(16)))
    const bytes = require('crypto').randomBytes(16);
    return bytes.toString('hex').toLowerCase();
  }
}

module.exports = ArchivedNoteRepository;
