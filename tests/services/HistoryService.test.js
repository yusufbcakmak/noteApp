const HistoryService = require('../../src/services/HistoryService');
const dbConnection = require('../../src/config/database');
const UserRepository = require('../../src/repositories/UserRepository');
const NoteRepository = require('../../src/repositories/NoteRepository');
const fs = require('fs');
const path = require('path');

describe('HistoryService', () => {
  let historyService;
  let userRepository;
  let noteRepository;
  let testUser;
  let testNote;
  let testDbPath;

  beforeAll(async () => {
    // Create a test database
    testDbPath = path.join(__dirname, '../test-history-service-db.sqlite');
    
    // Remove existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Override database path for testing
    dbConnection.dbPath = testDbPath;
    dbConnection.connect();

    // Create tables
    const createTablesQuery = `
      CREATE TABLE users (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active INTEGER DEFAULT 1,
        last_login_at DATETIME
      );

      CREATE TABLE notes (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL,
        group_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
        priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE completed_notes (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL,
        original_note_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        group_name TEXT,
        priority TEXT NOT NULL,
        completed_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL
      );
    `;
    
    dbConnection.getDatabase().exec(createTablesQuery);
    
    // Initialize services and repositories
    historyService = new HistoryService().init();
    userRepository = new UserRepository().init();
    noteRepository = new NoteRepository().init();
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

    // Create test note
    testNote = await noteRepository.create({
      userId: testUser.id,
      title: 'Test Note',
      description: 'Test description',
      status: 'done',
      priority: 'medium',
      completedAt: new Date().toISOString()
    });
  });

  afterAll(async () => {
    // Clean up and close database connection
    dbConnection.close();
    
    // Clean up test database file
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('archiveNote', () => {
    it('should archive a completed note', async () => {
      const archivedNote = await historyService.archiveNote(testNote, 'Test Group');

      expect(archivedNote).toBeDefined();
      expect(archivedNote.originalNoteId).toBe(testNote.id);
      expect(archivedNote.title).toBe(testNote.title);
      expect(archivedNote.description).toBe(testNote.description);
      expect(archivedNote.groupName).toBe('Test Group');
      expect(archivedNote.priority).toBe(testNote.priority);
      expect(archivedNote.userId).toBe(testUser.id);
      expect(archivedNote.completedAt).toBeDefined();
    });

    it('should archive note without group', async () => {
      const archivedNote = await historyService.archiveNote(testNote);

      expect(archivedNote).toBeDefined();
      expect(archivedNote.groupName).toBeNull();
    });

    it('should handle archiving errors gracefully', async () => {
      const invalidNote = { ...testNote, userId: null };

      await expect(historyService.archiveNote(invalidNote))
        .rejects.toThrow('Failed to archive note');
    });

    it('should prevent duplicate archiving', async () => {
      await historyService.archiveNote(testNote, 'Test Group');

      await expect(historyService.archiveNote(testNote, 'Test Group'))
        .rejects.toThrow('Note is already archived');
    });
  });

  describe('getHistory', () => {
    beforeEach(async () => {
      // Archive the test note
      await historyService.archiveNote(testNote, 'Test Group');

      // Create additional archived notes
      for (let i = 1; i <= 5; i++) {
        const note = await noteRepository.create({
          userId: testUser.id,
          title: `Note ${i}`,
          description: `Description ${i}`,
          status: 'done',
          priority: i % 2 === 0 ? 'high' : 'low',
          completedAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString()
        });
        await historyService.archiveNote(note, i % 2 === 0 ? 'Group A' : 'Group B');
      }
    });

    it('should get history with pagination', async () => {
      const result = await historyService.getHistory(testUser.id, {
        page: 1,
        limit: 3
      });

      expect(result.history).toHaveLength(3);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(3);
      expect(result.pagination.total).toBe(6);
      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(false);
    });

    it('should filter history by priority', async () => {
      const result = await historyService.getHistory(testUser.id, {
        priority: 'high'
      });

      expect(result.history.length).toBeGreaterThan(0);
      result.history.forEach(item => {
        expect(item.priority).toBe('high');
      });
    });

    it('should filter history by group name', async () => {
      const result = await historyService.getHistory(testUser.id, {
        groupName: 'Group A'
      });

      expect(result.history.length).toBeGreaterThan(0);
      result.history.forEach(item => {
        expect(item.groupName).toBe('Group A');
      });
    });

    it('should filter history by date range', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];

      const result = await historyService.getHistory(testUser.id, {
        startDate: yesterday,
        endDate: today
      });

      expect(result.history.length).toBeGreaterThan(0);
    });

    it('should sort history by different fields', async () => {
      const result = await historyService.getHistory(testUser.id, {
        sortBy: 'title',
        sortOrder: 'ASC'
      });

      expect(result.history.length).toBeGreaterThan(1);
      
      // Check if sorted by title ascending
      for (let i = 1; i < result.history.length; i++) {
        expect(result.history[i].title >= result.history[i - 1].title).toBe(true);
      }
    });

    it('should return empty result for user with no history', async () => {
      const otherUser = await userRepository.create({
        email: 'other-history@example.com',
        password: 'hashedpassword123',
        firstName: 'Other',
        lastName: 'User'
      });

      const result = await historyService.getHistory(otherUser.id);

      expect(result.history).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe('getDailyStats', () => {
    beforeEach(async () => {
      // Create notes completed on different days
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);

      // Today: 2 high, 1 medium
      for (let i = 0; i < 3; i++) {
        const note = await noteRepository.create({
          userId: testUser.id,
          title: `Today Note ${i}`,
          status: 'done',
          priority: i < 2 ? 'high' : 'medium',
          completedAt: today.toISOString()
        });
        await historyService.archiveNote(note);
      }

      // Yesterday: 1 low, 1 medium
      for (let i = 0; i < 2; i++) {
        const note = await noteRepository.create({
          userId: testUser.id,
          title: `Yesterday Note ${i}`,
          status: 'done',
          priority: i === 0 ? 'low' : 'medium',
          completedAt: yesterday.toISOString()
        });
        await historyService.archiveNote(note);
      }

      // Two days ago: 1 high
      const oldNote = await noteRepository.create({
        userId: testUser.id,
        title: 'Old Note',
        status: 'done',
        priority: 'high',
        completedAt: twoDaysAgo.toISOString()
      });
      await historyService.archiveNote(oldNote);
    });

    it('should get daily completion statistics', async () => {
      const stats = await historyService.getDailyStats(testUser.id);

      expect(stats).toHaveLength(3); // 3 different days
      
      // Check today's stats
      const todayStats = stats.find(s => s.date === new Date().toISOString().split('T')[0]);
      expect(todayStats).toBeDefined();
      expect(todayStats.totalCompleted).toBe(3);
      expect(todayStats.byPriority.high).toBe(2);
      expect(todayStats.byPriority.medium).toBe(1);
      expect(todayStats.byPriority.low).toBe(0);
    });

    it('should filter stats by date range', async () => {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const stats = await historyService.getDailyStats(testUser.id, {
        startDate: yesterday,
        endDate: today
      });

      // Should have at least 1 day of stats, could be 1 or 2 depending on when notes were created
      expect(stats.length).toBeGreaterThanOrEqual(1);
      expect(stats.length).toBeLessThanOrEqual(2);
    });

    it('should respect limit parameter', async () => {
      const stats = await historyService.getDailyStats(testUser.id, {
        limit: 2
      });

      expect(stats.length).toBeLessThanOrEqual(2);
    });

    it('should return empty array for user with no completed notes', async () => {
      const otherUser = await userRepository.create({
        email: 'other-stats@example.com',
        password: 'hashedpassword123',
        firstName: 'Other',
        lastName: 'User'
      });

      const stats = await historyService.getDailyStats(otherUser.id);

      expect(stats).toHaveLength(0);
    });
  });

  describe('isNoteArchived', () => {
    it('should return true for archived note', async () => {
      await historyService.archiveNote(testNote);

      const isArchived = await historyService.isNoteArchived(testNote.id);

      expect(isArchived).toBe(true);
    });

    it('should return false for non-archived note', async () => {
      const isArchived = await historyService.isNoteArchived('nonexistent');

      expect(isArchived).toBe(false);
    });
  });

  describe('deleteArchivedNote', () => {
    it('should delete archived note', async () => {
      await historyService.archiveNote(testNote);

      const deleted = await historyService.deleteArchivedNote(testNote.id, testUser.id);

      expect(deleted).toBe(true);

      const isArchived = await historyService.isNoteArchived(testNote.id);
      expect(isArchived).toBe(false);
    });

    it('should return false for non-existent archived note', async () => {
      const deleted = await historyService.deleteArchivedNote('nonexistent', testUser.id);

      expect(deleted).toBe(false);
    });
  });
});