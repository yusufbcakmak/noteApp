const express = require('express');
const NoteController = require('../controllers/NoteController');
const authMiddleware = require('../middleware/auth');
const ValidationMiddleware = require('../middleware/validation');
const { noteSchemas, paramSchemas } = require('../validation/schemas');

/**
 * Note routes
 * @swagger
 * tags:
 *   name: Notes
 *   description: Note management operations
 */
class NoteRoutes {
  constructor() {
    this.router = express.Router();
    this.noteController = new NoteController();
    this.authMiddleware = authMiddleware;
    this.setupRoutes();
  }

  /**
   * Initialize routes with database connection
   */
  init() {
    this.noteController.init();
    this.authMiddleware.init();
    return this;
  }

  /**
   * Setup note routes
   */
  setupRoutes() {
    // All note routes require authentication
    this.router.use(this.authMiddleware.authenticate);
    this.router.use(this.authMiddleware.requireActiveUser);

    // Statistics and recent notes (should come before :id routes)
    this.router.get('/stats', this.noteController.getNoteStats);
    this.router.get('/recent', 
      ValidationMiddleware.validateQuery(noteSchemas.recentQuery),
      this.noteController.getRecentNotes
    );

    // CRUD operations
    /**
     * @swagger
     * /api/notes:
     *   get:
     *     tags: [Notes]
     *     summary: Get user's notes
     *     description: Retrieve a paginated list of notes for the authenticated user
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - $ref: '#/components/parameters/PageParam'
     *       - $ref: '#/components/parameters/LimitParam'
     *       - $ref: '#/components/parameters/SortByParam'
     *       - $ref: '#/components/parameters/SortOrderParam'
     *       - name: status
     *         in: query
     *         schema:
     *           type: string
     *           enum: [todo, in_progress, done]
     *         description: Filter by note status
     *       - name: priority
     *         in: query
     *         schema:
     *           type: string
     *           enum: [low, medium, high]
     *         description: Filter by note priority
     *       - name: groupId
     *         in: query
     *         schema:
     *           type: string
     *           pattern: '^[a-f0-9]{32}$'
     *         description: Filter by group ID
     *       - name: search
     *         in: query
     *         schema:
     *           type: string
     *           maxLength: 255
     *         description: Search in note titles and descriptions
     *     responses:
     *       200:
     *         description: Notes retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/PaginatedResponse'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       type: object
     *                       properties:
     *                         items:
     *                           type: array
     *                           items:
     *                             $ref: '#/components/schemas/Note'
     *       400:
     *         $ref: '#/components/responses/BadRequest'
     *       401:
     *         $ref: '#/components/responses/Unauthorized'
     *       500:
     *         $ref: '#/components/responses/InternalServerError'
     */
    this.router.get('/', 
      ValidationMiddleware.validateQuery(noteSchemas.query),
      this.noteController.getNotes
    );
    /**
     * @swagger
     * /api/notes:
     *   post:
     *     tags: [Notes]
     *     summary: Create a new note
     *     description: Create a new note for the authenticated user
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/CreateNoteRequest'
     *     responses:
     *       201:
     *         description: Note created successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                   example: true
     *                 data:
     *                   $ref: '#/components/schemas/Note'
     *       400:
     *         $ref: '#/components/responses/BadRequest'
     *       401:
     *         $ref: '#/components/responses/Unauthorized'
     *       500:
     *         $ref: '#/components/responses/InternalServerError'
     */
    this.router.post('/', 
      ValidationMiddleware.validateBody(noteSchemas.create),
      this.noteController.createNote
    );
    this.router.get('/:id', 
      ValidationMiddleware.validateParams(paramSchemas.id),
      this.noteController.getNoteById
    );
    this.router.put('/:id', 
      ValidationMiddleware.validateParams(paramSchemas.id),
      ValidationMiddleware.validateBody(noteSchemas.update),
      this.noteController.updateNote
    );
    this.router.patch('/:id/status', 
      ValidationMiddleware.validateParams(paramSchemas.id),
      ValidationMiddleware.validateBody(noteSchemas.statusUpdate),
      this.noteController.updateNoteStatus
    );
    this.router.delete('/:id', 
      ValidationMiddleware.validateParams(paramSchemas.id),
      this.noteController.deleteNote
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

module.exports = NoteRoutes;