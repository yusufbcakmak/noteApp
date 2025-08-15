const CompletedNoteRepository = require('../repositories/CompletedNoteRepository');
const CompletedNote = require('../models/CompletedNote');

/**
 * History service for managing completed notes archiving
 */
class HistoryService {
  constructor() {
    this.completedNoteRepository = new CompletedNoteRepository();
  }

  /**
   * Initialize service with database connection
   */
  init() {
    this.completedNoteRepository.initialize();
    return this;
  }

  /**
   * Archive a completed note to history
   * @param {Object} note - Note object to archive
   * @param {string} groupName - Name of the group (if any)
   * @returns {Promise<Object>} - Archived note record
   */
  async archiveNote(note, groupName = null) {
    try {
      // Check if note is already archived
      const isAlreadyArchived = await this.completedNoteRepository.existsByOriginalNoteId(note.id);
      if (isAlreadyArchived) {
        throw new Error('Note is already archived');
      }

      // Create completed note from the original note
      const completedNote = CompletedNote.fromNote(note, groupName);
      
      // Save to repository
      const archivedNote = await this.completedNoteRepository.create(completedNote.toDatabase());
      
      return archivedNote.toJSON();
    } catch (error) {
      throw new Error(`Failed to archive note: ${error.message}`);
    }
  }

  /**
   * Get completed notes history for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - History with pagination
   */
  async getHistory(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        startDate,
        endDate,
        priority,
        groupName,
        sortBy = 'completed_at',
        sortOrder = 'DESC'
      } = options;

      const offset = (page - 1) * limit;

      const queryOptions = {
        startDate,
        endDate,
        priority,
        groupName,
        limit,
        offset,
        orderBy: sortBy,
        orderDirection: sortOrder
      };

      // Get completed notes and total count
      const [completedNotes, total] = await Promise.all([
        this.completedNoteRepository.findByUserId(userId, queryOptions),
        this.completedNoteRepository.countByUserId(userId, { startDate, endDate, priority, groupName })
      ]);

      return {
        history: completedNotes.map(note => note.toJSON()),
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
      throw new Error(`Failed to get history: ${error.message}`);
    }
  }

  /**
   * Get daily completion statistics
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Daily statistics
   */
  async getDailyStats(userId, options = {}) {
    try {
      const {
        startDate,
        endDate,
        limit = 30
      } = options;

      const stats = await this.completedNoteRepository.getDailyStats(userId, {
        startDate,
        endDate,
        limit
      });

      return stats.map(stat => ({
        date: stat.date,
        totalCompleted: stat.count,
        byPriority: {
          high: stat.priorityBreakdown.high,
          medium: stat.priorityBreakdown.medium,
          low: stat.priorityBreakdown.low
        }
      }));
    } catch (error) {
      throw new Error(`Failed to get daily stats: ${error.message}`);
    }
  }

  /**
   * Check if a note is already archived
   * @param {string} originalNoteId - Original note ID
   * @returns {Promise<boolean>} - True if already archived
   */
  async isNoteArchived(originalNoteId) {
    try {
      return await this.completedNoteRepository.existsByOriginalNoteId(originalNoteId);
    } catch (error) {
      throw new Error(`Failed to check if note is archived: ${error.message}`);
    }
  }

  /**
   * Delete archived note (for cleanup when original note is permanently deleted)
   * @param {string} originalNoteId - Original note ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - True if deleted
   */
  async deleteArchivedNote(originalNoteId, userId) {
    try {
      // Find the completed note first to get its ID
      const completedNotes = await this.completedNoteRepository.findByUserId(userId, {
        limit: 1000 // Get all to find the one with matching original_note_id
      });
      
      const completedNote = completedNotes.find(note => note.originalNoteId === originalNoteId);
      
      if (!completedNote) {
        return false;
      }

      return await this.completedNoteRepository.deleteById(completedNote.id);
    } catch (error) {
      throw new Error(`Failed to delete archived note: ${error.message}`);
    }
  }

  /**
   * Get priority statistics for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Priority statistics
   */
  async getPriorityStats(userId, options = {}) {
    try {
      return await this.completedNoteRepository.getPriorityStats(userId, options);
    } catch (error) {
      throw new Error(`Failed to get priority stats: ${error.message}`);
    }
  }

  /**
   * Get group statistics for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Group statistics
   */
  async getGroupStats(userId, options = {}) {
    try {
      return await this.completedNoteRepository.getGroupStats(userId, options);
    } catch (error) {
      throw new Error(`Failed to get group stats: ${error.message}`);
    }
  }

  /**
   * Get recent completed notes for a user
   * @param {string} userId - User ID
   * @param {number} limit - Number of recent notes to get
   * @returns {Promise<Array>} - Recent completed notes
   */
  async getRecentCompleted(userId, limit = 10) {
    try {
      const recentNotes = await this.completedNoteRepository.getRecent(userId, limit);
      return recentNotes.map(note => note.toJSON());
    } catch (error) {
      throw new Error(`Failed to get recent completed notes: ${error.message}`);
    }
  }
}

module.exports = HistoryService;