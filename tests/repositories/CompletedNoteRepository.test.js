const CompletedNoteRepository = require('../../src/repositories/CompletedNoteRepository');
const CompletedNote = require('../../src/models/CompletedNote');
const dbConnection = require('../../src/config/database');
const fs = require('fs');
const path = require('path');

describe('CompletedNoteRepository', () => {
  let repository;
  let testUserId;
  let testCompletedNote;
  let testDbPath;

  beforeAll(async () => {
    // Create a test database
    testDbPath = path.join(__dirname, '../test-completed-notes-db.sqlite');
    
    // Remove existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Override database path for testing
    dbConnection.dbPath = testDbPath;
    dbConnection.connect();

    // Create completed_notes table
    const createTableQuery = `
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
      )
    `;
    
    dbConnection.getDatabase().exec(createTableQuery);
    
    repository = new CompletedNoteRepository();
    repository.initialize();
    
    testUserId = 'test-user-123';
  });

  beforeEach(async () => {
    // Clean up completed_notes table
    const db = dbConnection.getDatabase();
    db.exec('DELETE FROM completed_notes');
    
    // Create test completed note data
    testCompletedNote = {
      userId: testUserId,
      originalNoteId: 'original-note-123',
      title: 'Test Completed Note',
      description: 'Test description',
      groupName: 'Test Group',
      priority: 'high',
      completedAt: '2024-01-01T10:00:00Z',
      createdAt: '2024-01-01T09:00:00Z'
    };
  });

  afterAll(async () => {
    dbConnection.close();
    
    // Clean up test database file
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('create', () => {
    it('should create a new completed note', async () => {
      const result = await repository.create(testCompletedNote);
      
      expect(result).toBeInstanceOf(CompletedNote);
      expect(result.id).toBeDefined();
      expect(result.userId).toBe(testUserId);
      expect(result.title).toBe('Test Completed Note');
      expect(result.priority).toBe('high');
    });

    it('should generate ID if not provided', async () => {
      const result = await repository.create(testCompletedNote);
      
      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should use provided ID', async () => {
      const customId = 'custom-id-123';
      const noteWithId = { ...testCompletedNote, id: customId };
      
      const result = await repository.create(noteWithId);
      
      expect(result.id).toBe(customId);
    });

    it('should throw error for invalid data', async () => {
      const invalidNote = { ...testCompletedNote };
      delete invalidNote.userId;
      
      await expect(repository.create(invalidNote)).rejects.toThrow('Validation error');
    });

    it('should throw error for duplicate ID', async () => {
      const customId = 'duplicate-id';
      const noteWithId = { ...testCompletedNote, id: customId };
      
      await repository.create(noteWithId);
      
      await expect(repository.create(noteWithId)).rejects.toThrow('already exists');
    });
  });

  describe('findById', () => {
    it('should find completed note by ID', async () => {
      const created = await repository.create(testCompletedNote);
      const found = await repository.findById(created.id);
      
      expect(found).toBeInstanceOf(CompletedNote);
      expect(found.id).toBe(created.id);
      expect(found.title).toBe('Test Completed Note');
    });

    it('should return null for non-existent ID', async () => {
      const found = await repository.findById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('findByUserId', () => {
    beforeEach(async () => {
      // Create multiple test completed notes
      await repository.create({
        ...testCompletedNote,
        title: 'Note 1',
        priority: 'high',
        completedAt: '2024-01-01T10:00:00Z'
      });
      
      await repository.create({
        ...testCompletedNote,
        originalNoteId: 'original-note-456',
        title: 'Note 2',
        priority: 'medium',
        groupName: 'Another Group',
        completedAt: '2024-01-02T10:00:00Z'
      });
      
      await repository.create({
        ...testCompletedNote,
        originalNoteId: 'original-note-789',
        title: 'Note 3',
        priority: 'low',
        completedAt: '2024-01-03T10:00:00Z'
      });
    });

    it('should find all completed notes for user', async () => {
      const results = await repository.findByUserId(testUserId);
      
      expect(results).toHaveLength(3);
      expect(results[0]).toBeInstanceOf(CompletedNote);
      expect(results.every(note => note.userId === testUserId)).toBe(true);
    });

    it('should apply date filtering', async () => {
      const results = await repository.findByUserId(testUserId, {
        startDate: '2024-01-02T00:00:00Z',
        endDate: '2024-01-02T23:59:59Z'
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Note 2');
    });

    it('should apply priority filtering', async () => {
      const results = await repository.findByUserId(testUserId, {
        priority: 'high'
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].priority).toBe('high');
    });

    it('should apply group filtering', async () => {
      const results = await repository.findByUserId(testUserId, {
        groupName: 'Another Group'
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].groupName).toBe('Another Group');
    });

    it('should apply pagination', async () => {
      const results = await repository.findByUserId(testUserId, {
        limit: 2,
        offset: 1
      });
      
      expect(results).toHaveLength(2);
    });

    it('should apply ordering', async () => {
      const results = await repository.findByUserId(testUserId, {
        orderBy: 'title',
        orderDirection: 'ASC'
      });
      
      expect(results[0].title).toBe('Note 1');
      expect(results[1].title).toBe('Note 2');
      expect(results[2].title).toBe('Note 3');
    });

    it('should return empty array for non-existent user', async () => {
      const results = await repository.findByUserId('non-existent-user');
      expect(results).toHaveLength(0);
    });
  });

  describe('countByUserId', () => {
    beforeEach(async () => {
      await repository.create(testCompletedNote);
      await repository.create({
        ...testCompletedNote,
        originalNoteId: 'original-note-456',
        priority: 'medium'
      });
    });

    it('should count all completed notes for user', async () => {
      const count = await repository.countByUserId(testUserId);
      expect(count).toBe(2);
    });

    it('should count with priority filter', async () => {
      const count = await repository.countByUserId(testUserId, {
        priority: 'high'
      });
      expect(count).toBe(1);
    });

    it('should return 0 for non-existent user', async () => {
      const count = await repository.countByUserId('non-existent-user');
      expect(count).toBe(0);
    });
  });

  describe('getDailyStats', () => {
    beforeEach(async () => {
      // Create notes for different days and priorities
      await repository.create({
        ...testCompletedNote,
        priority: 'high',
        completedAt: '2024-01-01T10:00:00Z'
      });
      
      await repository.create({
        ...testCompletedNote,
        originalNoteId: 'note-2',
        priority: 'medium',
        completedAt: '2024-01-01T11:00:00Z'
      });
      
      await repository.create({
        ...testCompletedNote,
        originalNoteId: 'note-3',
        priority: 'low',
        completedAt: '2024-01-02T10:00:00Z'
      });
    });

    it('should return daily statistics', async () => {
      const stats = await repository.getDailyStats(testUserId);
      
      expect(stats).toHaveLength(2);
      expect(stats[0].date).toBe('2024-01-02');
      expect(stats[0].count).toBe(1);
      expect(stats[0].priorityBreakdown.low).toBe(1);
      
      expect(stats[1].date).toBe('2024-01-01');
      expect(stats[1].count).toBe(2);
      expect(stats[1].priorityBreakdown.high).toBe(1);
      expect(stats[1].priorityBreakdown.medium).toBe(1);
    });

    it('should apply date filtering', async () => {
      const stats = await repository.getDailyStats(testUserId, {
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-01T23:59:59Z'
      });
      
      expect(stats).toHaveLength(1);
      expect(stats[0].date).toBe('2024-01-01');
    });

    it('should apply limit', async () => {
      const stats = await repository.getDailyStats(testUserId, {
        limit: 1
      });
      
      expect(stats).toHaveLength(1);
    });
  });

  describe('getPriorityStats', () => {
    beforeEach(async () => {
      await repository.create({ ...testCompletedNote, priority: 'high' });
      await repository.create({ 
        ...testCompletedNote, 
        originalNoteId: 'note-2',
        priority: 'high' 
      });
      await repository.create({ 
        ...testCompletedNote, 
        originalNoteId: 'note-3',
        priority: 'medium' 
      });
    });

    it('should return priority statistics', async () => {
      const stats = await repository.getPriorityStats(testUserId);
      
      expect(stats.high).toBe(2);
      expect(stats.medium).toBe(1);
      expect(stats.low).toBe(0);
    });

    it('should apply date filtering', async () => {
      const stats = await repository.getPriorityStats(testUserId, {
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-01T23:59:59Z'
      });
      
      expect(typeof stats.high).toBe('number');
      expect(typeof stats.medium).toBe('number');
      expect(typeof stats.low).toBe('number');
    });
  });

  describe('getGroupStats', () => {
    beforeEach(async () => {
      await repository.create({ 
        ...testCompletedNote, 
        groupName: 'Group A' 
      });
      await repository.create({ 
        ...testCompletedNote, 
        originalNoteId: 'note-2',
        groupName: 'Group A' 
      });
      await repository.create({ 
        ...testCompletedNote, 
        originalNoteId: 'note-3',
        groupName: 'Group B' 
      });
      await repository.create({ 
        ...testCompletedNote, 
        originalNoteId: 'note-4',
        groupName: null 
      });
    });

    it('should return group statistics', async () => {
      const stats = await repository.getGroupStats(testUserId);
      
      expect(stats).toHaveLength(3);
      expect(stats[0].groupName).toBe('Group A');
      expect(stats[0].count).toBe(2);
      expect(stats[1].groupName).toBe('Group B');
      expect(stats[1].count).toBe(1);
      expect(stats[2].groupName).toBe('Ungrouped');
      expect(stats[2].count).toBe(1);
    });

    it('should apply limit', async () => {
      const stats = await repository.getGroupStats(testUserId, {
        limit: 2
      });
      
      expect(stats).toHaveLength(2);
    });
  });

  describe('deleteById', () => {
    it('should delete completed note by ID', async () => {
      const created = await repository.create(testCompletedNote);
      const deleted = await repository.deleteById(created.id);
      
      expect(deleted).toBe(true);
      
      const found = await repository.findById(created.id);
      expect(found).toBeNull();
    });

    it('should return false for non-existent ID', async () => {
      const deleted = await repository.deleteById('non-existent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('deleteByUserId', () => {
    beforeEach(async () => {
      await repository.create(testCompletedNote);
      await repository.create({
        ...testCompletedNote,
        originalNoteId: 'note-2'
      });
    });

    it('should delete all completed notes for user', async () => {
      const deletedCount = await repository.deleteByUserId(testUserId);
      
      expect(deletedCount).toBe(2);
      
      const remaining = await repository.findByUserId(testUserId);
      expect(remaining).toHaveLength(0);
    });

    it('should return 0 for non-existent user', async () => {
      const deletedCount = await repository.deleteByUserId('non-existent-user');
      expect(deletedCount).toBe(0);
    });
  });

  describe('getRecent', () => {
    beforeEach(async () => {
      await repository.create({
        ...testCompletedNote,
        completedAt: '2024-01-01T10:00:00Z'
      });
      await repository.create({
        ...testCompletedNote,
        originalNoteId: 'note-2',
        completedAt: '2024-01-02T10:00:00Z'
      });
      await repository.create({
        ...testCompletedNote,
        originalNoteId: 'note-3',
        completedAt: '2024-01-03T10:00:00Z'
      });
    });

    it('should return recent completed notes', async () => {
      const recent = await repository.getRecent(testUserId, 2);
      
      expect(recent).toHaveLength(2);
      expect(recent[0]).toBeInstanceOf(CompletedNote);
      expect(recent[0].completedAt).toBe('2024-01-03T10:00:00Z');
      expect(recent[1].completedAt).toBe('2024-01-02T10:00:00Z');
    });

    it('should apply default limit', async () => {
      const recent = await repository.getRecent(testUserId);
      expect(recent.length).toBeLessThanOrEqual(10);
    });
  });

  describe('existsByOriginalNoteId', () => {
    it('should return true if completed note exists', async () => {
      await repository.create(testCompletedNote);
      
      const exists = await repository.existsByOriginalNoteId('original-note-123');
      expect(exists).toBe(true);
    });

    it('should return false if completed note does not exist', async () => {
      const exists = await repository.existsByOriginalNoteId('non-existent-note');
      expect(exists).toBe(false);
    });
  });
});