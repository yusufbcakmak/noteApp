const express = require('express');
const GroupController = require('../controllers/GroupController');
const authMiddleware = require('../middleware/auth');
const ValidationMiddleware = require('../middleware/validation');
const { groupSchemas, paramSchemas } = require('../validation/schemas');

/**
 * Group routes
 */
class GroupRoutes {
  constructor() {
    this.router = express.Router();
    this.groupController = new GroupController();
    this.authMiddleware = authMiddleware;
    this.setupRoutes();
  }

  /**
   * Initialize routes with database connection
   */
  init() {
    this.groupController.init();
    this.authMiddleware.init();
    return this;
  }

  /**
   * Setup group routes
   */
  setupRoutes() {
    // All group routes require authentication
    this.router.use(this.authMiddleware.authenticate);
    this.router.use(this.authMiddleware.requireActiveUser);

    // Statistics (should come before :id routes)
    this.router.get('/stats', this.groupController.getGroupStats);

    // CRUD operations
    this.router.get('/', 
      ValidationMiddleware.validateQuery(groupSchemas.query),
      this.groupController.getGroups
    );
    this.router.post('/', 
      ValidationMiddleware.validateBody(groupSchemas.create),
      this.groupController.createGroup
    );
    this.router.get('/:id', 
      ValidationMiddleware.validateParams(paramSchemas.id),
      this.groupController.getGroupById
    );
    this.router.put('/:id', 
      ValidationMiddleware.validateParams(paramSchemas.id),
      ValidationMiddleware.validateBody(groupSchemas.update),
      this.groupController.updateGroup
    );
    this.router.delete('/:id', 
      ValidationMiddleware.validateParams(paramSchemas.id),
      ValidationMiddleware.validateQuery(groupSchemas.deleteQuery),
      this.groupController.deleteGroup
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

module.exports = GroupRoutes;