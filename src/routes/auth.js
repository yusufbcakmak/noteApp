const express = require('express');
const AuthController = require('../controllers/AuthController');
const authMiddleware = require('../middleware/auth');
const SecurityMiddleware = require('../middleware/security');
const ValidationMiddleware = require('../middleware/validation');
const { authSchemas, paramSchemas } = require('../validation/schemas');

/**
 * Authentication routes
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and authorization
 */
class AuthRoutes {
  constructor() {
    this.router = express.Router();
    this.authController = new AuthController();
    this.authMiddleware = authMiddleware;
    this.setupRoutes();
  }

  /**
   * Initialize routes with database connection
   */
  init() {
    this.authController.init();
    this.authMiddleware.init();
    return this;
  }

  /**
   * Setup authentication routes
   */
  setupRoutes() {
    // Public routes (no authentication required)
    this.router.get('/health', this.authController.health);

    // Registration and login routes with rate limiting
    /**
     * @swagger
     * /api/auth/register:
     *   post:
     *     tags: [Authentication]
     *     summary: Register a new user
     *     description: Create a new user account with email and password
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/RegisterRequest'
     *     responses:
     *       201:
     *         description: User registered successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/AuthResponse'
     *       400:
     *         $ref: '#/components/responses/BadRequest'
     *       409:
     *         $ref: '#/components/responses/Conflict'
     *       429:
     *         $ref: '#/components/responses/TooManyRequests'
     *       500:
     *         $ref: '#/components/responses/InternalServerError'
     */
    this.router.post('/register', 
      SecurityMiddleware.createAuthRateLimit({ max: 5, windowMs: 15 * 60 * 1000 }),
      ValidationMiddleware.validateBody(authSchemas.register),
      this.authMiddleware.logAuthEvent,
      this.authController.register
    );

    /**
     * @swagger
     * /api/auth/login:
     *   post:
     *     tags: [Authentication]
     *     summary: User login
     *     description: Authenticate user with email and password
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/LoginRequest'
     *     responses:
     *       200:
     *         description: Login successful
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/AuthResponse'
     *       400:
     *         $ref: '#/components/responses/BadRequest'
     *       401:
     *         $ref: '#/components/responses/Unauthorized'
     *       429:
     *         $ref: '#/components/responses/TooManyRequests'
     *       500:
     *         $ref: '#/components/responses/InternalServerError'
     */
    this.router.post('/login', 
      SecurityMiddleware.createAuthRateLimit({ max: 5, windowMs: 15 * 60 * 1000 }),
      ValidationMiddleware.validateBody(authSchemas.login),
      this.authMiddleware.logAuthEvent,
      this.authController.login
    );

    // Token refresh route
    this.router.post('/refresh', 
      SecurityMiddleware.createAuthRateLimit({ max: 10, windowMs: 15 * 60 * 1000 }),
      ValidationMiddleware.validateBody(authSchemas.refreshToken),
      this.authController.refresh
    );

    // Password reset route
    this.router.post('/forgot-password', 
      SecurityMiddleware.createAuthRateLimit({ max: 3, windowMs: 60 * 60 * 1000 }),
      ValidationMiddleware.validateBody(authSchemas.forgotPassword),
      this.authController.forgotPassword
    );

    // Protected routes (authentication required)
    this.router.use(this.authMiddleware.authenticate);
    this.router.use(this.authMiddleware.requireActiveUser);

    // User profile and account management
    /**
     * @swagger
     * /api/auth/me:
     *   get:
     *     tags: [Authentication]
     *     summary: Get current user profile
     *     description: Get the profile of the currently authenticated user
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: User profile retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                   example: true
     *                 data:
     *                   $ref: '#/components/schemas/User'
     *       401:
     *         $ref: '#/components/responses/Unauthorized'
     *       500:
     *         $ref: '#/components/responses/InternalServerError'
     */
    this.router.get('/me', this.authController.me);
    this.router.get('/verify', this.authController.verify);
    
    // Logout route
    this.router.post('/logout', 
      this.authMiddleware.logAuthEvent,
      this.authController.logout
    );

    // Password change route
    this.router.post('/change-password', 
      SecurityMiddleware.createAuthRateLimit({ max: 3, windowMs: 60 * 60 * 1000 }),
      ValidationMiddleware.validateBody(authSchemas.changePassword),
      this.authController.changePassword
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

module.exports = AuthRoutes;