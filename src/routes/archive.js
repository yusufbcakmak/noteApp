const express = require('express');
const ArchivedNoteController = require('../controllers/ArchivedNoteController');
const authMiddleware = require('../middleware/auth');
const ValidationMiddleware = require('../middleware/validation');

/**
 * Archive routes
 * @swagger
 * tags:
 *   name: Archive
 *   description: Archived note management operations
 */
class ArchiveRoutes {
  constructor() {
    this.router = express.Router();
    this.archivedNoteController = new ArchivedNoteController();
    this.authMiddleware = authMiddleware;
    this.setupRoutes();
  }

  /**
   * Initialize routes with database connection
   */
  init() {
    this.archivedNoteController.init();
    this.authMiddleware.init();
    return this;
  }

  /**
   * Get the router instance
   */
  getRouter() {
    return this.router;
  }

  /**
   * Setup all routes
   */
  setupRoutes() {
    /**
     * @swagger
     * /api/archive:
     *   get:
     *     summary: Get all archived notes for the authenticated user
     *     tags: [Archive]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *           minimum: 1
     *           default: 1
     *         description: Page number for pagination
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           minimum: 1
     *           maximum: 100
     *           default: 10
     *         description: Number of items per page
     *       - in: query
     *         name: priority
     *         schema:
     *           type: string
     *           enum: [low, medium, high]
     *         description: Filter by priority
     *       - in: query
     *         name: groupName
     *         schema:
     *           type: string
     *         description: Filter by group name
     *       - in: query
     *         name: search
     *         schema:
     *           type: string
     *         description: Search in title and description
     *       - in: query
     *         name: sortBy
     *         schema:
     *           type: string
     *           enum: [archived_at, completed_at, created_at, title, priority]
     *           default: archived_at
     *         description: Sort field
     *       - in: query
     *         name: sortOrder
     *         schema:
     *           type: string
     *           enum: [ASC, DESC]
     *           default: DESC
     *         description: Sort order
     *     responses:
     *       200:
     *         description: Archived notes retrieved successfully
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Internal server error
     */
    this.router.get('/', this.authMiddleware.authenticate, this.archivedNoteController.getArchivedNotes.bind(this.archivedNoteController));

    /**
     * @swagger
     * /api/archive/stats:
     *   get:
     *     summary: Get archived note statistics
     *     tags: [Archive]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Statistics retrieved successfully
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Internal server error
     */
    this.router.get('/stats', this.authMiddleware.authenticate, this.archivedNoteController.getArchivedStats.bind(this.archivedNoteController));

    /**
     * @swagger
     * /api/archive/recent:
     *   get:
     *     summary: Get recent archived notes
     *     tags: [Archive]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           minimum: 1
     *           maximum: 20
     *           default: 5
     *         description: Number of recent archived notes to return
     *     responses:
     *       200:
     *         description: Recent archived notes retrieved successfully
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Internal server error
     */
    this.router.get('/recent', this.authMiddleware.authenticate, this.archivedNoteController.getRecentArchivedNotes.bind(this.archivedNoteController));

    /**
     * @swagger
     * /api/archive/{id}:
     *   get:
     *     summary: Get a specific archived note by ID
     *     tags: [Archive]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Archived note ID
     *     responses:
     *       200:
     *         description: Archived note retrieved successfully
     *       404:
     *         description: Archived note not found
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Internal server error
     */
    this.router.get('/:id', this.authMiddleware.authenticate, this.archivedNoteController.getArchivedNoteById.bind(this.archivedNoteController));

    /**
     * @swagger
     * /api/archive/{noteId}:
     *   post:
     *     summary: Archive a completed note manually
     *     tags: [Archive]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: noteId
     *         required: true
     *         schema:
     *           type: string
     *         description: Note ID to archive
     *     responses:
     *       200:
     *         description: Note archived successfully
     *       400:
     *         description: Bad request (note not completed or already archived)
     *       404:
     *         description: Note not found
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Internal server error
     */
    this.router.post('/:noteId', this.authMiddleware.authenticate, this.archivedNoteController.archiveNote.bind(this.archivedNoteController));

    /**
     * @swagger
     * /api/archive/{id}/unarchive:
     *   post:
     *     summary: Unarchive a note (restore to active notes)
     *     tags: [Archive]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Archived note ID
     *     responses:
     *       200:
     *         description: Note unarchived successfully
     *       404:
     *         description: Archived note not found
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Internal server error
     */
    this.router.post('/:id/unarchive', this.authMiddleware.authenticate, this.archivedNoteController.unarchiveNote.bind(this.archivedNoteController));

    /**
     * @swagger
     * /api/archive/{id}:
     *   delete:
     *     summary: Delete an archived note permanently
     *     tags: [Archive]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Archived note ID
     *     responses:
     *       200:
     *         description: Archived note deleted successfully
     *       404:
     *         description: Archived note not found
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Internal server error
     */
    this.router.delete('/:id', this.authMiddleware.authenticate, this.archivedNoteController.deleteArchivedNote.bind(this.archivedNoteController));
  }
}

module.exports = ArchiveRoutes;
