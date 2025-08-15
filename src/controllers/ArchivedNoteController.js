const ArchivedNote = require('../models/ArchivedNote');
const ArchivedNoteRepository = require('../repositories/ArchivedNoteRepository');
const Note = require('../models/Note');
const NoteRepository = require('../repositories/NoteRepository');
const dbConnection = require('../config/database');

/**
 * ArchivedNote controller for handling archived note-related HTTP requests
 */
class ArchivedNoteController {
  constructor() {
    this.archivedNoteRepository = null;
    this.noteRepository = null;
    this.db = null;
  }

  /**
   * Initialize controller with database connection
   */
  init() {
    this.db = dbConnection.getDatabase();
    this.archivedNoteRepository = new ArchivedNoteRepository().init();
    this.noteRepository = new NoteRepository().init();
    return this;
  }

  /**
   * Get archived notes for the authenticated user
   * GET /api/archive
   */
  getArchivedNotes = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { 
        search = '', 
        priority = '', 
        groupId = '',
        page = 1, 
        limit = 10 
      } = req.query;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
      const offset = (pageNum - 1) * limitNum;

      // Build where conditions
      let whereConditions = ['n.status = ?'];
      let params = ['archived'];

      whereConditions.push('n.user_id = ?');
      params.push(userId);

      if (search) {
        whereConditions.push('(n.title LIKE ? OR n.description LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
      }

      if (priority) {
        whereConditions.push('n.priority = ?');
        params.push(priority);
      }

      if (groupId) {
        whereConditions.push('n.group_id = ?');
        params.push(groupId);
      }

      const whereClause = whereConditions.join(' AND ');

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM notes n WHERE ${whereClause}`;
      const totalResult = this.db.prepare(countQuery).get(params);
      const total = totalResult.total;

      // Get notes with group names
      const query = `
        SELECT 
          n.*,
          g.name as group_name
        FROM notes n
        LEFT JOIN groups g ON n.group_id = g.id AND g.user_id = n.user_id
        WHERE ${whereClause}
        ORDER BY n.updated_at DESC
        LIMIT ? OFFSET ?
      `;

      const archivedNotes = this.db.prepare(query).all([...params, limitNum, offset]);

      res.json({
        success: true,
        data: archivedNotes,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get a specific archived note by ID
   * GET /api/archive/:id
   */
  getArchivedNoteById = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Find the archived note using noteRepository
      const note = await this.noteRepository.findByIdAndUserId(id, userId);

      if (!note || note.status !== 'archived') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'ARCHIVED_NOTE_NOT_FOUND',
            message: 'Archived note not found'
          },
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        data: note.toJSON(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Archive a note by updating its status to 'archived'
   * POST /api/archive/:noteId
   */
  archiveNote = async (req, res, next) => {
    try {
      const { noteId } = req.params;
      const userId = req.user.id;

      // Find the note
      const note = await this.noteRepository.findByIdAndUserId(noteId, userId);
      if (!note) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOTE_NOT_FOUND',
            message: 'Note not found'
          },
          timestamp: new Date().toISOString()
        });
      }

      // Check if note is completed
      if (note.status !== 'done') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NOTE_NOT_COMPLETED',
            message: 'Only completed notes can be archived'
          },
          timestamp: new Date().toISOString()
        });
      }

      // Check if already archived
      if (note.status === 'archived') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NOTE_ALREADY_ARCHIVED',
            message: 'Note is already archived'
          },
          timestamp: new Date().toISOString()
        });
      }

      // Update note status to archived
      const archivedNote = await this.noteRepository.updateStatus(noteId, 'archived', userId);

      res.json({
        success: true,
        data: archivedNote.toJSON(),
        message: 'Note archived successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Unarchive a note by updating its status back to 'done'
   * POST /api/archive/:id/unarchive
   */
  unarchiveNote = async (req, res, next) => {
    try {
      const { id: noteId } = req.params;
      const userId = req.user.id;

      // Find the archived note
      const note = await this.noteRepository.findByIdAndUserId(noteId, userId);
      if (!note) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOTE_NOT_FOUND',
            message: 'Note not found'
          },
          timestamp: new Date().toISOString()
        });
      }

      // Check if note is archived
      if (note.status !== 'archived') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NOTE_NOT_ARCHIVED',
            message: 'Note is not archived'
          },
          timestamp: new Date().toISOString()
        });
      }

      // Update note status back to done
      const restoredNote = await this.noteRepository.updateStatus(noteId, 'done', userId);

      res.json({
        success: true,
        data: restoredNote.toJSON(),
        message: 'Note unarchived successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

    /**
   * Delete an archived note permanently
   * DELETE /api/archive/:id
   */
  deleteArchivedNote = async (req, res, next) => {
    try {
      const { id: noteId } = req.params;
      const userId = req.user.id;

      // Find the archived note
      const note = await this.noteRepository.findByIdAndUserId(noteId, userId);
      if (!note) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOTE_NOT_FOUND',
            message: 'Note not found'
          },
          timestamp: new Date().toISOString()
        });
      }

      // Check if note is archived
      if (note.status !== 'archived') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NOTE_NOT_ARCHIVED',
            message: 'Note is not archived'
          },
          timestamp: new Date().toISOString()
        });
      }

      // Delete the note permanently
      await this.noteRepository.delete(noteId, userId);

      res.json({
        success: true,
        message: 'Archived note deleted permanently',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get archive statistics for the authenticated user
   * GET /api/archive/stats
   */
  getArchivedStats = async (req, res, next) => {
    try {
      const userId = req.user.id;

      // Get priority counts for archived notes
      const priorityQuery = `
        SELECT priority, COUNT(*) as count 
        FROM notes 
        WHERE user_id = ? AND status = 'archived'
        GROUP BY priority
      `;
      const priorityResults = this.db.prepare(priorityQuery).all(userId);
      
      const priorityCounts = {
        low: 0,
        medium: 0,
        high: 0
      };
      
      priorityResults.forEach(row => {
        priorityCounts[row.priority] = row.count;
      });

      // Get group counts for archived notes
      const groupQuery = `
        SELECT g.name, COUNT(*) as count 
        FROM notes n
        LEFT JOIN groups g ON n.group_id = g.id
        WHERE n.user_id = ? AND n.status = 'archived'
        GROUP BY g.name
      `;
      const groupResults = this.db.prepare(groupQuery).all(userId);
      
      const groupCounts = {};
      groupResults.forEach(row => {
        const groupName = row.name || 'No Group';
        groupCounts[groupName] = row.count;
      });

      res.json({
        success: true,
        data: {
          priorityCounts,
          groupCounts
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get recent archived notes for the authenticated user
   * GET /api/archive/recent
   */
  getRecentArchivedNotes = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { limit = 5 } = req.query;

      const limitNum = Math.min(20, Math.max(1, parseInt(limit))); // Max 20 recent archived notes

      // Get recent archived notes using direct SQL query
      const query = `
        SELECT 
          n.*,
          g.name as group_name
        FROM notes n
        LEFT JOIN groups g ON n.group_id = g.id
        WHERE n.user_id = ? AND n.status = 'archived'
        ORDER BY n.updated_at DESC
        LIMIT ?
      `;

      const archivedNotes = this.db.prepare(query).all(userId, limitNum);

      res.json({
        success: true,
        data: archivedNotes,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = ArchivedNoteController;
