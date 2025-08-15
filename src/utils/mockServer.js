const express = require('express');
const cors = require('cors');
const SwaggerConfig = require('../config/swagger');
const logger = require('./logger');

/**
 * Mock server for frontend development with real API contracts
 */
class MockServer {
  constructor(options = {}) {
    this.app = express();
    this.port = options.port || 3001;
    this.swaggerConfig = new SwaggerConfig();
    this.spec = null;
    this.server = null;
    this.mockData = new Map();
    this.requestLog = [];
  }

  /**
   * Initialize the mock server
   */
  async init() {
    this.spec = this.swaggerConfig.getSpec();
    this.setupMiddleware();
    this.generateMockData();
    this.setupRoutes();
    logger.info('Mock server initialized');
  }

  /**
   * Setup middleware
   */
  setupMiddleware() {
    // Enable CORS for frontend development
    this.app.use(cors({
      origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080'],
      credentials: true
    }));

    // Parse JSON bodies
    this.app.use(express.json());

    // Request logging
    this.app.use((req, res, next) => {
      const requestInfo = {
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        query: req.query,
        body: req.body,
        headers: req.headers
      };
      
      this.requestLog.push(requestInfo);
      
      // Keep only last 100 requests
      if (this.requestLog.length > 100) {
        this.requestLog.shift();
      }

      logger.debug(`Mock API: ${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Generate mock data from OpenAPI schemas
   */
  generateMockData() {
    if (!this.spec || !this.spec.components || !this.spec.components.schemas) {
      return;
    }

    const schemas = this.spec.components.schemas;

    // Generate sample users
    this.mockData.set('users', [
      {
        id: 'a1b2c3d4e5f6789012345678901234ab',
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        lastLoginAt: '2024-01-15T10:30:00Z'
      },
      {
        id: 'b2c3d4e5f6789012345678901234abc',
        email: 'jane.smith@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        isActive: true,
        createdAt: '2024-01-02T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
        lastLoginAt: '2024-01-15T09:15:00Z'
      }
    ]);

    // Generate sample notes
    this.mockData.set('notes', [
      {
        id: 'note1234567890abcdef1234567890ab',
        userId: 'a1b2c3d4e5f6789012345678901234ab',
        groupId: 'group123456789abcdef123456789ab',
        title: 'Complete project documentation',
        description: 'Write comprehensive documentation for the API project',
        status: 'in_progress',
        priority: 'high',
        createdAt: '2024-01-10T00:00:00Z',
        updatedAt: '2024-01-12T00:00:00Z',
        completedAt: null
      },
      {
        id: 'note2345678901bcdef2345678901bcd',
        userId: 'a1b2c3d4e5f6789012345678901234ab',
        groupId: null,
        title: 'Review code changes',
        description: 'Review the latest pull requests',
        status: 'todo',
        priority: 'medium',
        createdAt: '2024-01-11T00:00:00Z',
        updatedAt: '2024-01-11T00:00:00Z',
        completedAt: null
      },
      {
        id: 'note3456789012cdef3456789012cdef',
        userId: 'a1b2c3d4e5f6789012345678901234ab',
        groupId: 'group123456789abcdef123456789ab',
        title: 'Setup CI/CD pipeline',
        description: 'Configure automated testing and deployment',
        status: 'done',
        priority: 'high',
        createdAt: '2024-01-08T00:00:00Z',
        updatedAt: '2024-01-09T00:00:00Z',
        completedAt: '2024-01-09T15:30:00Z'
      }
    ]);

    // Generate sample groups
    this.mockData.set('groups', [
      {
        id: 'group123456789abcdef123456789ab',
        userId: 'a1b2c3d4e5f6789012345678901234ab',
        name: 'Work Projects',
        description: 'Tasks related to work projects',
        color: '#3498db',
        createdAt: '2024-01-05T00:00:00Z',
        updatedAt: '2024-01-05T00:00:00Z',
        noteCount: 2
      },
      {
        id: 'group234567890bcdef234567890bcd',
        userId: 'a1b2c3d4e5f6789012345678901234ab',
        name: 'Personal',
        description: 'Personal tasks and reminders',
        color: '#e74c3c',
        createdAt: '2024-01-06T00:00:00Z',
        updatedAt: '2024-01-06T00:00:00Z',
        noteCount: 0
      }
    ]);

    // Generate sample completed notes
    this.mockData.set('completedNotes', [
      {
        id: 'completed123456789abcdef12345678',
        userId: 'a1b2c3d4e5f6789012345678901234ab',
        originalNoteId: 'note3456789012cdef3456789012cdef',
        title: 'Setup CI/CD pipeline',
        description: 'Configure automated testing and deployment',
        groupName: 'Work Projects',
        priority: 'high',
        completedAt: '2024-01-09T15:30:00Z',
        createdAt: '2024-01-08T00:00:00Z'
      }
    ]);

    logger.info('Mock data generated');
  }

  /**
   * Setup routes based on OpenAPI specification
   */
  setupRoutes() {
    if (!this.spec || !this.spec.paths) {
      return;
    }

    // Mock server info endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'Note Management API Mock Server',
        version: this.spec.info.version,
        description: 'Mock server for frontend development',
        endpoints: Object.keys(this.spec.paths),
        requestLog: `/mock/requests`,
        mockData: `/mock/data`
      });
    });

    // Mock server utilities
    this.app.get('/mock/requests', (req, res) => {
      res.json({
        requests: this.requestLog,
        count: this.requestLog.length
      });
    });

    this.app.get('/mock/data', (req, res) => {
      const data = {};
      for (const [key, value] of this.mockData) {
        data[key] = value;
      }
      res.json(data);
    });

    // Authentication endpoints
    this.setupAuthRoutes();

    // Notes endpoints
    this.setupNotesRoutes();

    // Groups endpoints
    this.setupGroupsRoutes();

    // History endpoints
    this.setupHistoryRoutes();

    // User endpoints
    this.setupUserRoutes();

    // Catch-all for undefined routes
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Mock endpoint ${req.method} ${req.originalUrl} not implemented`
        }
      });
    });
  }

  /**
   * Setup authentication routes
   */
  setupAuthRoutes() {
    // Login
    this.app.post('/api/auth/login', (req, res) => {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Email and password are required'
          }
        });
      }

      const user = this.mockData.get('users').find(u => u.email === email);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password'
          }
        });
      }

      res.json({
        success: true,
        data: {
          user,
          token: 'mock-jwt-token-' + Date.now(),
          refreshToken: 'mock-refresh-token-' + Date.now(),
          expiresIn: 3600
        }
      });
    });

    // Register
    this.app.post('/api/auth/register', (req, res) => {
      const { email, password, firstName, lastName } = req.body;
      
      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'All fields are required'
          }
        });
      }

      const existingUser = this.mockData.get('users').find(u => u.email === email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'USER_EXISTS',
            message: 'User with this email already exists'
          }
        });
      }

      const newUser = {
        id: this.generateId(),
        email,
        firstName,
        lastName,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: null
      };

      this.mockData.get('users').push(newUser);

      res.status(201).json({
        success: true,
        data: {
          user: newUser,
          token: 'mock-jwt-token-' + Date.now(),
          refreshToken: 'mock-refresh-token-' + Date.now(),
          expiresIn: 3600
        }
      });
    });

    // Get current user
    this.app.get('/api/auth/me', this.requireAuth, (req, res) => {
      res.json({
        success: true,
        data: req.user
      });
    });
  }

  /**
   * Setup notes routes
   */
  setupNotesRoutes() {
    // Get notes
    this.app.get('/api/notes', this.requireAuth, (req, res) => {
      const { page = 1, limit = 10, status, priority, groupId, search } = req.query;
      let notes = this.mockData.get('notes').filter(note => note.userId === req.user.id);

      // Apply filters
      if (status) {
        notes = notes.filter(note => note.status === status);
      }
      if (priority) {
        notes = notes.filter(note => note.priority === priority);
      }
      if (groupId && groupId !== 'null') {
        notes = notes.filter(note => note.groupId === groupId);
      }
      if (search) {
        const searchLower = search.toLowerCase();
        notes = notes.filter(note => 
          note.title.toLowerCase().includes(searchLower) ||
          (note.description && note.description.toLowerCase().includes(searchLower))
        );
      }

      // Pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      const paginatedNotes = notes.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: {
          items: paginatedNotes,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: notes.length,
            totalPages: Math.ceil(notes.length / limit),
            hasNext: endIndex < notes.length,
            hasPrev: page > 1
          }
        }
      });
    });

    // Create note
    this.app.post('/api/notes', this.requireAuth, (req, res) => {
      const { title, description, priority = 'medium', groupId } = req.body;

      if (!title) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Title is required'
          }
        });
      }

      const newNote = {
        id: this.generateId(),
        userId: req.user.id,
        groupId: groupId || null,
        title,
        description: description || '',
        status: 'todo',
        priority,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null
      };

      this.mockData.get('notes').push(newNote);

      res.status(201).json({
        success: true,
        data: newNote
      });
    });

    // Get note by ID
    this.app.get('/api/notes/:id', this.requireAuth, (req, res) => {
      const note = this.mockData.get('notes').find(n => 
        n.id === req.params.id && n.userId === req.user.id
      );

      if (!note) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Note not found'
          }
        });
      }

      res.json({
        success: true,
        data: note
      });
    });

    // Update note
    this.app.put('/api/notes/:id', this.requireAuth, (req, res) => {
      const noteIndex = this.mockData.get('notes').findIndex(n => 
        n.id === req.params.id && n.userId === req.user.id
      );

      if (noteIndex === -1) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Note not found'
          }
        });
      }

      const note = this.mockData.get('notes')[noteIndex];
      const updates = req.body;

      // Update fields
      Object.keys(updates).forEach(key => {
        if (key !== 'id' && key !== 'userId' && key !== 'createdAt') {
          note[key] = updates[key];
        }
      });

      note.updatedAt = new Date().toISOString();

      // If status changed to done, set completedAt
      if (updates.status === 'done' && note.status !== 'done') {
        note.completedAt = new Date().toISOString();
      } else if (updates.status !== 'done') {
        note.completedAt = null;
      }

      this.mockData.get('notes')[noteIndex] = note;

      res.json({
        success: true,
        data: note
      });
    });

    // Delete note
    this.app.delete('/api/notes/:id', this.requireAuth, (req, res) => {
      const noteIndex = this.mockData.get('notes').findIndex(n => 
        n.id === req.params.id && n.userId === req.user.id
      );

      if (noteIndex === -1) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Note not found'
          }
        });
      }

      this.mockData.get('notes').splice(noteIndex, 1);

      res.json({
        success: true,
        message: 'Note deleted successfully'
      });
    });
  }

  /**
   * Setup groups routes
   */
  setupGroupsRoutes() {
    // Get groups
    this.app.get('/api/groups', this.requireAuth, (req, res) => {
      const groups = this.mockData.get('groups').filter(group => group.userId === req.user.id);

      res.json({
        success: true,
        data: {
          items: groups,
          pagination: {
            page: 1,
            limit: 100,
            total: groups.length,
            totalPages: 1,
            hasNext: false,
            hasPrev: false
          }
        }
      });
    });

    // Create group
    this.app.post('/api/groups', this.requireAuth, (req, res) => {
      const { name, description, color = '#3498db' } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Name is required'
          }
        });
      }

      const newGroup = {
        id: this.generateId(),
        userId: req.user.id,
        name,
        description: description || '',
        color,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        noteCount: 0
      };

      this.mockData.get('groups').push(newGroup);

      res.status(201).json({
        success: true,
        data: newGroup
      });
    });
  }

  /**
   * Setup history routes
   */
  setupHistoryRoutes() {
    // Get history
    this.app.get('/api/history', this.requireAuth, (req, res) => {
      const completedNotes = this.mockData.get('completedNotes').filter(note => 
        note.userId === req.user.id
      );

      res.json({
        success: true,
        data: {
          items: completedNotes,
          pagination: {
            page: 1,
            limit: 100,
            total: completedNotes.length,
            totalPages: 1,
            hasNext: false,
            hasPrev: false
          }
        }
      });
    });

    // Get daily stats
    this.app.get('/api/history/daily', this.requireAuth, (req, res) => {
      res.json({
        success: true,
        data: {
          stats: [
            { date: '2024-01-15', completed: 3, created: 2 },
            { date: '2024-01-14', completed: 1, created: 4 },
            { date: '2024-01-13', completed: 2, created: 1 }
          ]
        }
      });
    });
  }

  /**
   * Setup user routes
   */
  setupUserRoutes() {
    // Get profile
    this.app.get('/api/user/profile', this.requireAuth, (req, res) => {
      res.json({
        success: true,
        data: req.user
      });
    });

    // Update profile
    this.app.put('/api/user/profile', this.requireAuth, (req, res) => {
      const userIndex = this.mockData.get('users').findIndex(u => u.id === req.user.id);
      if (userIndex === -1) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'User not found'
          }
        });
      }

      const user = this.mockData.get('users')[userIndex];
      const updates = req.body;

      // Update allowed fields
      ['firstName', 'lastName', 'email'].forEach(field => {
        if (updates[field]) {
          user[field] = updates[field];
        }
      });

      user.updatedAt = new Date().toISOString();
      this.mockData.get('users')[userIndex] = user;

      res.json({
        success: true,
        data: user
      });
    });
  }

  /**
   * Authentication middleware
   */
  requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authorization token required'
        }
      });
    }

    // In a real implementation, you'd verify the JWT token
    // For mock purposes, we'll just use the first user
    req.user = this.mockData.get('users')[0];
    next();
  };

  /**
   * Generate mock ID
   */
  generateId() {
    return Math.random().toString(16).substring(2, 34).padEnd(32, '0');
  }

  /**
   * Start the mock server
   */
  async start() {
    if (!this.spec) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, (err) => {
        if (err) {
          reject(err);
        } else {
          logger.info(`Mock server running on http://localhost:${this.port}`);
          resolve(this.server);
        }
      });
    });
  }

  /**
   * Stop the mock server
   */
  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          this.server = null;
          logger.info('Mock server stopped');
          resolve();
        });
      });
    }
  }
}

module.exports = MockServer;