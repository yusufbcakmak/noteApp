const Note = require('../models/Note');
const NoteRepository = require('../repositories/NoteRepository');
const HistoryService = require('../services/HistoryService');
const GroupRepository = require('../repositories/GroupRepository');

/**
 * Note controller for handling note-related HTTP requests
 */
class NoteController {
  constructor() {
    this.noteRepository = null;
    this.historyService = null;
    this.groupRepository = null;
  }

  /**
   * Initialize controller with database connection
   */
  init() {
    this.noteRepository = new NoteRepository().init();
    this.historyService = new HistoryService().init();
    this.groupRepository = new GroupRepository().init();
    return this;
  }

  /**
   * Get all notes for the authenticated user
   * GET /api/notes
   */
  getNotes = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const {
        page = 1,
        limit = 10,
        status,
        priority,
        groupId,
        search,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = req.query;

      // Validate pagination parameters
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit))); // Max 100 items per page

      const options = {
        page: pageNum,
        limit: limitNum,
        status,
        priority,
        groupId: groupId === 'null' ? null : groupId,
        search,
        sortBy,
        sortOrder
      };

      const result = await this.noteRepository.findWithPagination(userId, options);

      res.json({
        success: true,
        data: {
          items: result.notes.map(note => note.toJSON()),
          pagination: result.pagination
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get a specific note by ID
   * GET /api/notes/:id
   */
  getNoteById = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const note = await this.noteRepository.findByIdAndUserId(id, userId);

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
   * Create a new note
   * POST /api/notes
   */
  createNote = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const noteData = { 
        ...req.body, 
        userId,
        // Ensure groupId is null if empty string
        groupId: req.body.groupId === '' ? null : req.body.groupId
      };

      const note = await this.noteRepository.create(noteData);

      res.status(201).json({
        success: true,
        data: note.toJSON(),
        message: 'Note created successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update an existing note
   * PUT /api/notes/:id
   */
  updateNote = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Check if note exists and belongs to user
      const existingNote = await this.noteRepository.findByIdAndUserId(id, userId);
      if (!existingNote) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOTE_NOT_FOUND',
            message: 'Note not found'
          },
          timestamp: new Date().toISOString()
        });
      }

      const updateData = { 
        ...req.body,
        // Ensure groupId is null if empty string
        groupId: req.body.groupId === '' ? null : req.body.groupId
      };

      // Handle status change and completion timestamp
      if (updateData.status && updateData.status !== existingNote.status) {
        if (updateData.status === 'done' && existingNote.status !== 'done') {
          updateData.completedAt = new Date().toISOString();
        } else if (updateData.status !== 'done' && existingNote.status === 'done') {
          updateData.completedAt = null;
        }
      }

      const updatedNote = await this.noteRepository.update(id, updateData);

      if (!updatedNote) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOTE_NOT_FOUND',
            message: 'Note not found'
          },
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        data: updatedNote.toJSON(),
        message: 'Note updated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update note status
   * PATCH /api/notes/:id/status
   */
  updateNoteStatus = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const updatedNote = await this.noteRepository.updateStatus(id, req.body.status, userId);

      if (!updatedNote) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOTE_NOT_FOUND',
            message: 'Note not found'
          },
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        data: updatedNote.toJSON(),
        message: 'Note status updated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete a note
   * DELETE /api/notes/:id
   */
  deleteNote = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const deleted = await this.noteRepository.delete(id, userId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOTE_NOT_FOUND',
            message: 'Note not found'
          },
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        message: 'Note deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get note statistics for the authenticated user
   * GET /api/notes/stats
   */
  getNoteStats = async (req, res, next) => {
    try {
      const userId = req.user.id;

      const [statusCounts, priorityCounts] = await Promise.all([
        this.noteRepository.getStatusCounts(userId),
        this.noteRepository.getPriorityCounts(userId)
      ]);

      res.json({
        success: true,
        data: {
          statusCounts,
          priorityCounts
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get recent notes for the authenticated user
   * GET /api/notes/recent
   */
  getRecentNotes = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { limit = 5 } = req.query;

      const limitNum = Math.min(20, Math.max(1, parseInt(limit))); // Max 20 recent notes

      const notes = await this.noteRepository.getRecentNotes(userId, limitNum);

      res.json({
        success: true,
        data: notes.map(note => note.toJSON()),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = NoteController;