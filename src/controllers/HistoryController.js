const HistoryService = require('../services/HistoryService');

/**
 * History controller for handling history-related HTTP requests
 */
class HistoryController {
  constructor() {
    this.historyService = null;
  }

  /**
   * Initialize controller with database connection
   */
  init() {
    this.historyService = new HistoryService().init();
    return this;
  }

  /**
   * Get completed notes history for the authenticated user
   * GET /api/history
   */
  getHistory = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const {
        page = 1,
        limit = 10,
        startDate,
        endDate,
        priority,
        groupName,
        sortBy = 'completed_at',
        sortOrder = 'DESC'
      } = req.query;

      // Validate pagination parameters
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit))); // Max 100 items per page

      const options = {
        page: pageNum,
        limit: limitNum,
        startDate,
        endDate,
        priority,
        groupName,
        sortBy,
        sortOrder
      };

      const result = await this.historyService.getHistory(userId, options);

      res.json({
        success: true,
        data: {
          history: result.history,
          pagination: result.pagination
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get daily completion statistics
   * GET /api/history/daily
   */
  getDailyStats = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const {
        startDate,
        endDate,
        limit = 30
      } = req.query;

      const limitNum = Math.min(365, Math.max(1, parseInt(limit))); // Max 365 days

      const options = {
        startDate,
        endDate,
        limit: limitNum
      };

      const stats = await this.historyService.getDailyStats(userId, options);

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = HistoryController;