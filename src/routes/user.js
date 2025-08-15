const express = require('express');
const UserController = require('../controllers/UserController');
const authMiddleware = require('../middleware/auth');

/**
 * User profile routes
 */
class UserRoutes {
  constructor() {
    this.router = express.Router();
    this.userController = new UserController();
    this.authMiddleware = authMiddleware;
    this.setupRoutes();
  }

  /**
   * Initialize routes with database connection
   */
  init() {
    this.userController.init();
    this.authMiddleware.init();
    return this;
  }

  /**
   * Setup user profile routes
   */
  setupRoutes() {
    // All user routes require authentication
    this.router.use(this.authMiddleware.authenticate);
    this.router.use(this.authMiddleware.requireActiveUser);

    // Profile management routes
    this.router.get('/profile', this.userController.getProfile);
    this.router.put('/profile', this.userController.updateProfile);
    
    // Account deletion route with rate limiting
    this.router.delete('/account', 
      this.authMiddleware.rateLimitAuth(3, 60 * 60 * 1000), // 3 attempts per hour
      this.userController.deleteAccount
    );
  }

  /**
   * Get the router instance
   * @returns {express.Router} - Express router
   */
  getRouter() {
    return this.router;
  }
}

module.exports = UserRoutes;