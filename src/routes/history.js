const express = require('express');
const HistoryController = require('../controllers/HistoryController');
const authMiddleware = require('../middleware/auth');

/**
 * History routes
 */
class HistoryRoutes {
  constructor() {
    this.router = express.Router();
    this.historyController = new HistoryController();
    this.authMiddleware = authMiddleware;
    this.setupRoutes();
  }

  /**
   * Initialize routes with database connection
   */
  init() {
    this.historyController.init();
    this.authMiddleware.init();
    return this;
  }

  /**
   * Setup history routes
   */
  setupRoutes() {
    // All history routes require authentication
    this.router.use(this.authMiddleware.authenticate);
    this.router.use(this.authMiddleware.requireActiveUser);

    // History endpoints
    this.router.get('/', this.historyController.getHistory);
    this.router.get('/daily', this.historyController.getDailyStats);
  }

  /**
   * Get the router instance
   * @returns {express.Router} - Express router
   */
  getRouter() {
    return this.router;
  }
}

module.exports = HistoryRoutes;