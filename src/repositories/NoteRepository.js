const Note = require('../models/Note');
const dbConnection = require('../config/database');
const HistoryService = require('../services/HistoryService');

/**
 * Note repository for database operations
 */
class NoteRepository {
  constructor() {
    this.db = null;
    this.historyService = null;
    this.archivedNoteRepository = null;
  }

  /**
   * Initialize repository with database connection
   */
  init() {
    this.db = dbConnection.getDatabase();
    this.historyService = new HistoryService().init();
    // Lazy load to avoid circular dependencies
    const ArchivedNoteRepository = require('./ArchivedNoteRepository');
    this.archivedNoteRepository = new ArchivedNoteRepository().init();
    return this;
  }

  /**
   * Create a new note
   * @param {Object} noteData - Note data
   * @returns {Promise<Note>} - Created note
   */
  async create(noteData) {
    try {
      // Generate ID if not provided
      if (!noteData.id) {
        noteData.id = this._generateId();
      }

      // Set timestamps
      const now = new Date().toISOString();
      noteData.createdAt = now;
      noteData.updatedAt = now;

      const note = new Note(noteData);
      const dbData = note.toDatabaseFormat();

      const query = `
        INSERT INTO notes (
          id, user_id, group_id, title, description, 
          status, priority, created_at, updated_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        dbData.id,
        dbData.user_id,
        dbData.group_id,
        dbData.title,
        dbData.description,
        dbData.status,
        dbData.priority,
        dbData.created_at,
        dbData.updated_at,
        dbData.completed_at
      ];

      const result = this.db.prepare(query).run(params);

      if (result.changes === 0) {
        throw new Error('Failed to create note');
      }

      return this.findById(note.id);
    } catch (error) {
      throw new Error(`Failed to create note: ${error.message}`);
    }
  }

  /**
   * Find note by ID
   * @param {string} id - Note ID
   * @returns {Promise<Note|null>} - Note or null if not found
   */
  async findById(id) {
    try {
      const query = 'SELECT * FROM notes WHERE id = ?';
      const row = this.db.prepare(query).get(id);
      return Note.fromDatabaseRow(row);
    } catch (error) {
      throw new Error(`Failed to find note by ID: ${error.message}`);
    }
  }

  /**
   * Find note by ID and user ID (for authorization)
   * @param {string} id - Note ID
   * @param {string} userId - User ID
   * @returns {Promise<Note|null>} - Note or null if not found
   */
  async findByIdAndUserId(id, userId) {
    try {
      const query = 'SELECT * FROM notes WHERE id = ? AND user_id = ?';
      const row = this.db.prepare(query).get(id, userId);
      return Note.fromDatabaseRow(row);
    } catch (error) {
      throw new Error(`Failed to find note by ID and user ID: ${error.message}`);
    }
  }

  /**
   * Find all notes for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Note[]>} - Array of notes
   */
  async findByUserId(userId, options = {}) {
    try {
      const {
        status,
        priority,
        groupId,
        search,
        sortBy = 'created_at',
        sortOrder = 'DESC',
        limit,
        offset = 0
      } = options;

      let whereClause = 'WHERE user_id = ?';
      const params = [userId];

      // Add filters
      if (status) {
        whereClause += ' AND status = ?';
        params.push(status);
      }

      if (priority) {
        whereClause += ' AND priority = ?';
        params.push(priority);
      }

      if (groupId !== undefined) {
        if (groupId === null) {
          whereClause += ' AND group_id IS NULL';
        } else {
          whereClause += ' AND group_id = ?';
          params.push(groupId);
        }
      }

      if (search) {
        whereClause += ' AND (title LIKE ? OR description LIKE ?)';
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern);
      }

      // Build query
      let query = `SELECT * FROM notes ${whereClause}`;

      // Add sorting
      const validSortColumns = ['created_at', 'updated_at', 'title', 'priority', 'status'];
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
      return rows.map(row => Note.fromDatabaseRow(row));
    } catch (error) {
      throw new Error(`Failed to find notes by user ID: ${error.message}`);
    }
  }

  /**
   * Find notes with pagination
   * @param {string} userId - User ID
   * @param {Object} options - Pagination and filter options
   * @returns {Promise<Object>} - Notes with pagination info
   */
  async findWithPagination(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        priority,
        groupId,
        search,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = options;

      const offset = (page - 1) * limit;

      let whereClause = 'WHERE user_id = ?';
      const params = [userId];

      // Add filters
      if (status) {
        whereClause += ' AND status = ?';
        params.push(status);
      }

      if (priority) {
        whereClause += ' AND priority = ?';
        params.push(priority);
      }

      if (groupId !== undefined) {
        if (groupId === null) {
          whereClause += ' AND group_id IS NULL';
        } else {
          whereClause += ' AND group_id = ?';
          params.push(groupId);
        }
      }

      if (search) {
        whereClause += ' AND (title LIKE ? OR description LIKE ?)';
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern);
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) as count FROM notes ${whereClause}`;
      const countResult = this.db.prepare(countQuery).get(params);
      const total = countResult.count;

      // Get notes
      const validSortColumns = ['created_at', 'updated_at', 'title', 'priority', 'status'];
      const validSortOrders = ['ASC', 'DESC'];
      
      let notesQuery = `SELECT * FROM notes ${whereClause}`;
      
      if (validSortColumns.includes(sortBy) && validSortOrders.includes(sortOrder.toUpperCase())) {
        notesQuery += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;
      }
      
      notesQuery += ' LIMIT ? OFFSET ?';
      const notesParams = [...params, limit, offset];
      
      const rows = this.db.prepare(notesQuery).all(notesParams);
      const notes = rows.map(row => Note.fromDatabaseRow(row));

      return {
        notes,
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
      throw new Error(`Failed to find notes with pagination: ${error.message}`);
    }
  }

  /**
   * Update note
   * @param {string} id - Note ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Note|null>} - Updated note or null if not found
   */
  async update(id, updateData) {
    try {
      // Get the current note before updating to check for status changes
      const currentNote = await this.findById(id);
      if (!currentNote) {
        return null;
      }

      // Set updated timestamp
      updateData.updatedAt = new Date().toISOString();

      // Build dynamic update query only with provided fields
      const updateFields = [];
      const params = [];

      // Only include fields that are explicitly provided and not undefined
      Object.keys(updateData).forEach(key => {
        if (key !== 'id' && key !== 'userId' && updateData[key] !== undefined) {
          // Convert camelCase to snake_case for database
          const dbKey = key === 'userId' ? 'user_id' : 
                       key === 'groupId' ? 'group_id' :
                       key === 'createdAt' ? 'created_at' :
                       key === 'updatedAt' ? 'updated_at' :
                       key === 'completedAt' ? 'completed_at' : key;
          
          updateFields.push(`${dbKey} = ?`);
          params.push(updateData[key]);
        }
      });

      if (updateFields.length === 0) {
        throw new Error('No fields to update');
      }

      params.push(id);

      const query = `
        UPDATE notes 
        SET ${updateFields.join(', ')} 
        WHERE id = ?
      `;

      const result = this.db.prepare(query).run(params);

      if (result.changes === 0) {
        return null; // Note not found or no changes made
      }

      const updatedNote = await this.findById(id);

      // Archive note when status changes to 'done'
      if (updateData.status === 'done' && currentNote.status !== 'done') {
        await this._archiveCompletedNote(updatedNote);
      }

      return updatedNote;
    } catch (error) {
      throw new Error(`Failed to update note: ${error.message}`);
    }
  }

  /**
   * Update note status
   * @param {string} id - Note ID
   * @param {string} status - New status
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<Note|null>} - Updated note or null if not found
   */
  async updateStatus(id, status, userId) {
    try {
      // Get the current note before updating
      const currentNote = await this.findByIdAndUserId(id, userId);
      if (!currentNote) {
        return null; // Note not found or user not authorized
      }

      const now = new Date().toISOString();
      let completedAt = null;

      // Set completion timestamp when moving to done
      if (status === 'done') {
        completedAt = now;
      }

      const query = `
        UPDATE notes 
        SET status = ?, updated_at = ?, completed_at = ?
        WHERE id = ? AND user_id = ?
      `;

      const result = this.db.prepare(query).run(status, now, completedAt, id, userId);

      if (result.changes === 0) {
        return null; // Note not found or user not authorized
      }

      const updatedNote = await this.findById(id);

      // Archive note when status changes to 'done'
      if (status === 'done' && currentNote.status !== 'done') {
        await this._archiveCompletedNote(updatedNote);
      }

      return updatedNote;
    } catch (error) {
      throw new Error(`Failed to update note status: ${error.message}`);
    }
  }

  /**
   * Delete note
   * @param {string} id - Note ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<boolean>} - True if deleted successfully
   */
  async delete(id, userId) {
    try {
      const query = 'DELETE FROM notes WHERE id = ? AND user_id = ?';
      const result = this.db.prepare(query).run(id, userId);
      return result.changes > 0;
    } catch (error) {
      throw new Error(`Failed to delete note: ${error.message}`);
    }
  }

  /**
   * Get notes count by status for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Status counts
   */
  async getStatusCounts(userId) {
    try {
      const query = `
        SELECT 
          status,
          COUNT(*) as count
        FROM notes 
        WHERE user_id = ?
        GROUP BY status
      `;

      const rows = this.db.prepare(query).all(userId);
      
      const counts = {
        todo: 0,
        in_progress: 0,
        done: 0,
        total: 0
      };

      rows.forEach(row => {
        counts[row.status] = row.count;
        counts.total += row.count;
      });

      return counts;
    } catch (error) {
      throw new Error(`Failed to get status counts: ${error.message}`);
    }
  }

  /**
   * Get notes count by priority for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Priority counts
   */
  async getPriorityCounts(userId) {
    try {
      const query = `
        SELECT 
          priority,
          COUNT(*) as count
        FROM notes 
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
      throw new Error(`Failed to get priority counts: ${error.message}`);
    }
  }

  /**
   * Find notes by group ID
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<Note[]>} - Array of notes
   */
  async findByGroupId(groupId, userId) {
    try {
      const query = `
        SELECT * FROM notes 
        WHERE group_id = ? AND user_id = ?
        ORDER BY created_at DESC
      `;

      const rows = this.db.prepare(query).all(groupId, userId);
      return rows.map(row => Note.fromDatabaseRow(row));
    } catch (error) {
      throw new Error(`Failed to find notes by group ID: ${error.message}`);
    }
  }

  /**
   * Update notes group when group is deleted
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<number>} - Number of updated notes
   */
  async clearGroupId(groupId, userId) {
    try {
      const now = new Date().toISOString();
      const query = `
        UPDATE notes 
        SET group_id = NULL, updated_at = ?
        WHERE group_id = ? AND user_id = ?
      `;

      const result = this.db.prepare(query).run(now, groupId, userId);
      return result.changes;
    } catch (error) {
      throw new Error(`Failed to clear group ID: ${error.message}`);
    }
  }

  /**
   * Get recent notes for a user
   * @param {string} userId - User ID
   * @param {number} limit - Number of notes to return
   * @returns {Promise<Note[]>} - Array of recent notes
   */
  async getRecentNotes(userId, limit = 5) {
    try {
      const query = `
        SELECT * FROM notes 
        WHERE user_id = ?
        ORDER BY updated_at DESC
        LIMIT ?
      `;

      const rows = this.db.prepare(query).all(userId, limit);
      return rows.map(row => Note.fromDatabaseRow(row));
    } catch (error) {
      throw new Error(`Failed to get recent notes: ${error.message}`);
    }
  }

  /**
   * Archive a completed note to history
   * @param {Note} note - Note to archive
   * @returns {Promise<void>}
   */
  async _archiveCompletedNote(note) {
    try {
      // Get group name if note has a group
      let groupName = null;
      if (note.groupId) {
        const groupQuery = 'SELECT name FROM groups WHERE id = ?';
        const groupRow = this.db.prepare(groupQuery).get(note.groupId);
        groupName = groupRow ? groupRow.name : null;
      }

      // Archive using ArchivedNoteRepository
      if (this.archivedNoteRepository) {
        await this.archivedNoteRepository.archive(note, groupName);
      }

      // Also check if note is already archived to avoid duplicates in history
      const isArchived = await this.historyService.isNoteArchived(note.id);
      if (!isArchived) {
        await this.historyService.archiveNote(note, groupName);
      }
    } catch (error) {
      // Log error but don't fail the status update
      console.error(`Failed to archive note ${note.id}:`, error.message);
    }
  }

  /**
   * Generate a unique ID for note
   * @returns {string} - Generated ID
   */
  _generateId() {
    // Generate a random hex string (similar to SQLite's hex(randomblob(16)))
    const bytes = require('crypto').randomBytes(16);
    return bytes.toString('hex').toLowerCase();
  }
}

module.exports = NoteRepository;