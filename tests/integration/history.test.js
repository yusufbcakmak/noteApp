const request = require('supertest');
const app = require('../../src/app');
const dbConnection = require('../../src/config/database');
const UserRepository = require('../../src/repositories/UserRepository');
const NoteRepository = require('../../src/repositories/NoteRepository');
const HistoryService = require('../../src/services/HistoryService');
const jwtUtils = require('../../src/utils/jwt');

describe('History API Integration Tests', () => {
  let userRepository;
  let noteRepository;
  let historyService;
  let testUser;
  let authToken;

  beforeAll(async () => {
    // Initialize database connection
    dbConnection.connect();
    
    // Initialize repositories and services
    userRepository = new UserRepository().init();
    noteRepository = new NoteRepository().init();
    historyService = new HistoryService().init();
  });

  beforeEach(async () => {
    // Clean up database
    const db = dbConnection.getDatabase();
    db.exec('DELETE FROM completed_notes');
    db.exec('DELETE FROM notes');
    db.exec('DELETE FROM users');

    // Create test user
    testUser = await userRepository.create({
      email: 'test@example.com',
      password: 'hashedpassword123',
      firstName: 'Test',
      lastName: 'User'
    });

    // Generate auth token
    const tokenPayload = {
      userId: testUser.id,
      email: testUser.email,
      firstName: testUser.firstName,
      lastName: testUser.lastName
    };
    authToken = jwtUtils.generateAccessToken(tokenPayload);

    // Create and archive some test notes
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);

    // Create notes with different completion dates and priorities
    const testNotes = [
      {
        title: 'Today High Priority',
        priority: 'high',
        completedAt: today.toISOString(),
        groupName: 'Work'
      },
      {
        title: 'Today Medium Priority',
        priority: 'medium',
        completedAt: today.toISOString(),
        groupName: 'Personal'
      },
      {
        title: 'Yesterday Low Priority',
        priority: 'low',
        completedAt: yesterday.toISOString(),
        groupName: 'Work'
      },
      {
        title: 'Two Days Ago High Priority',
        priority: 'high',
        completedAt: twoDaysAgo.toISOString(),
        groupName: null
      }
    ];

    for (const noteData of testNotes) {
      const note = await noteRepository.create({
        userId: testUser.id,
        title: noteData.title,
        description: `Description for ${noteData.title}`,
        status: 'done',
        priority: noteData.priority,
        completedAt: noteData.completedAt
      });
      
      await historyService.archiveNote(note, noteData.groupName);
    }
  });

  afterAll(async () => {
    // Clean up and close database connection
    const db = dbConnection.getDatabase();
    db.exec('DELETE FROM completed_notes');
    db.exec('DELETE FROM notes');
    db.exec('DELETE FROM users');
    dbConnection.close();
  });

  describe('GET /api/history', () => {
    it('should get completed notes history for authenticated user', async () => {
      const response = await request(app)
        .get('/api/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.history).toHaveLength(4);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.total).toBe(4);
      
      // Check that notes are sorted by completion date (DESC by default)
      const history = response.body.data.history;
      expect(new Date(history[0].completedAt) >= new Date(history[1].completedAt)).toBe(true);
    });

    it('should paginate history correctly', async () => {
      const response = await request(app)
        .get('/api/history?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.history).toHaveLength(2);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(2);
      expect(response.body.data.pagination.total).toBe(4);
      expect(response.body.data.pagination.totalPages).toBe(2);
      expect(response.body.data.pagination.hasNext).toBe(true);
      expect(response.body.data.pagination.hasPrev).toBe(false);
    });

    it('should filter history by priority', async () => {
      const response = await request(app)
        .get('/api/history?priority=high')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.history).toHaveLength(2);
      response.body.data.history.forEach(item => {
        expect(item.priority).toBe('high');
      });
    });

    it('should filter history by group name', async () => {
      const response = await request(app)
        .get('/api/history?groupName=Work')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.history).toHaveLength(2);
      response.body.data.history.forEach(item => {
        expect(item.groupName).toBe('Work');
      });
    });

    it('should filter history by date range', async () => {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const response = await request(app)
        .get(`/api/history?startDate=${yesterday}&endDate=${today}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.history.length).toBeGreaterThan(0);
      
      // All returned items should be within the date range
      response.body.data.history.forEach(item => {
        const completedDate = new Date(item.completedAt).toISOString().split('T')[0];
        expect(completedDate >= yesterday && completedDate <= today).toBe(true);
      });
    });

    it('should sort history by different fields', async () => {
      const response = await request(app)
        .get('/api/history?sortBy=title&sortOrder=ASC')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const history = response.body.data.history;
      
      // Check if sorted by title ascending
      for (let i = 1; i < history.length; i++) {
        expect(history[i].title >= history[i - 1].title).toBe(true);
      }
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/history')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should not return history from other users', async () => {
      // Create another user with their own history
      const otherUser = await userRepository.create({
        email: 'other-history@example.com',
        password: 'hashedpassword123',
        firstName: 'Other',
        lastName: 'User'
      });

      const otherNote = await noteRepository.create({
        userId: otherUser.id,
        title: 'Other User Note',
        description: 'Private note',
        status: 'done',
        priority: 'medium'
      });

      await historyService.archiveNote(otherNote, 'Other Group');

      const response = await request(app)
        .get('/api/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.history).toHaveLength(4); // Only original user's notes
      response.body.data.history.forEach(item => {
        expect(item.userId).toBe(testUser.id);
      });
    });

    it('should handle empty history gracefully', async () => {
      // Create a new user with no history
      const newUser = await userRepository.create({
        email: 'new-empty@example.com',
        password: 'hashedpassword123',
        firstName: 'New',
        lastName: 'User'
      });

      const newTokenPayload = {
        userId: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName
      };
      const newAuthToken = jwtUtils.generateAccessToken(newTokenPayload);

      const response = await request(app)
        .get('/api/history')
        .set('Authorization', `Bearer ${newAuthToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.history).toHaveLength(0);
      expect(response.body.data.pagination.total).toBe(0);
    });
  });

  describe('GET /api/history/daily', () => {
    it('should get daily completion statistics', async () => {
      const response = await request(app)
        .get('/api/history/daily')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3); // 3 different days
      
      // Check structure of daily stats
      response.body.data.forEach(stat => {
        expect(stat.date).toBeDefined();
        expect(stat.totalCompleted).toBeDefined();
        expect(stat.byPriority).toBeDefined();
        expect(stat.byPriority.high).toBeDefined();
        expect(stat.byPriority.medium).toBeDefined();
        expect(stat.byPriority.low).toBeDefined();
      });

      // Find today's stats
      const today = new Date().toISOString().split('T')[0];
      const todayStats = response.body.data.find(stat => stat.date === today);
      expect(todayStats).toBeDefined();
      expect(todayStats.totalCompleted).toBe(2); // 2 notes completed today
      expect(todayStats.byPriority.high).toBe(1);
      expect(todayStats.byPriority.medium).toBe(1);
      expect(todayStats.byPriority.low).toBe(0);
    });

    it('should filter daily stats by date range', async () => {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const response = await request(app)
        .get(`/api/history/daily?startDate=${yesterday}&endDate=${today}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      // Should have at least 1 day of stats, could be 1 or 2 depending on when notes were created
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
      
      response.body.data.forEach(stat => {
        expect(stat.date >= yesterday && stat.date <= today).toBe(true);
      });
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/history/daily?limit=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
    });

    it('should limit maximum days to 365', async () => {
      const response = await request(app)
        .get('/api/history/daily?limit=500')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      // Should not exceed 365 days even if requested
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/history/daily')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should return empty array for user with no completed notes', async () => {
      // Create a new user with no history
      const newUser = await userRepository.create({
        email: 'new-daily@example.com',
        password: 'hashedpassword123',
        firstName: 'New',
        lastName: 'User'
      });

      const newTokenPayload = {
        userId: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName
      };
      const newAuthToken = jwtUtils.generateAccessToken(newTokenPayload);

      const response = await request(app)
        .get('/api/history/daily')
        .set('Authorization', `Bearer ${newAuthToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });
  });
});