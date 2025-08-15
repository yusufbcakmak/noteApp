const GroupRepository = require('../../src/repositories/GroupRepository');
const Group = require('../../src/models/Group');
const dbConnection = require('../../src/config/database');
const fs = require('fs');
const path = require('path');

describe('GroupRepository', () => {
  let groupRepository;
  let testDbPath;

  beforeAll(async () => {
    // Create a test database
    testDbPath = path.join(__dirname, '../test-groups-db.sqlite');
    
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

      CREATE TABLE groups (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT DEFAULT '#3498db',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL
      );

      CREATE INDEX idx_groups_user_id ON groups(user_id);
      CREATE INDEX idx_notes_group_id ON notes(group_id);
    `;

    const db = dbConnection.getDatabase();
    db.exec(createTablesQuery);
    
    // Disable foreign key constraints for testing
    db.exec('PRAGMA foreign_keys = OFF');

    groupRepository = new GroupRepository().init();
  });

  afterAll(async () => {
    // Close database connection
    dbConnection.close();
    
    // Remove test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  beforeEach(async () => {
    // Clear tables before each test
    const db = dbConnection.getDatabase();
    db.exec('DELETE FROM notes');
    db.exec('DELETE FROM groups');
    db.exec('DELETE FROM users');
  });

  describe('create', () => {
    it('should create a new group successfully', async () => {
      const groupData = {
        userId: 'user-123',
        name: 'Test Group',
        description: 'Test description',
        color: '#e74c3c'
      };

      const group = await groupRepository.create(groupData);

      expect(group).toBeInstanceOf(Group);
      expect(group.id).toBeDefined();
      expect(group.userId).toBe('user-123');
      expect(group.name).toBe('Test Group');
      expect(group.description).toBe('Test description');
      expect(group.color).toBe('#e74c3c');
      expect(group.createdAt).toBeDefined();
      expect(group.updatedAt).toBeDefined();
    });

    it('should create group with default color if not provided', async () => {
      const groupData = {
        userId: 'user-123',
        name: 'Test Group'
      };

      const group = await groupRepository.create(groupData);

      expect(group.color).toBe('#3498db');
    });

    it('should generate ID if not provided', async () => {
      const groupData = {
        userId: 'user-123',
        name: 'Test Group'
      };

      const group = await groupRepository.create(groupData);
      expect(group.id).toBeDefined();
      expect(group.id.length).toBe(32); // 16 bytes = 32 hex characters
    });
  });

  describe('findById', () => {
    it('should find group by ID', async () => {
      const groupData = {
        userId: 'user-123',
        name: 'Test Group',
        description: 'Test description'
      };

      const createdGroup = await groupRepository.create(groupData);
      const foundGroup = await groupRepository.findById(createdGroup.id);

      expect(foundGroup).toBeInstanceOf(Group);
      expect(foundGroup.id).toBe(createdGroup.id);
      expect(foundGroup.name).toBe('Test Group');
      expect(foundGroup.userId).toBe('user-123');
    });

    it('should return null for non-existent ID', async () => {
      const group = await groupRepository.findById('non-existent-id');
      expect(group).toBeNull();
    });
  });

  describe('findByIdAndUserId', () => {
    it('should find group by ID and user ID', async () => {
      const groupData = {
        userId: 'user-123',
        name: 'Test Group'
      };

      const createdGroup = await groupRepository.create(groupData);
      const foundGroup = await groupRepository.findByIdAndUserId(createdGroup.id, 'user-123');

      expect(foundGroup).toBeInstanceOf(Group);
      expect(foundGroup.id).toBe(createdGroup.id);
    });

    it('should return null for wrong user ID', async () => {
      const groupData = {
        userId: 'user-123',
        name: 'Test Group'
      };

      const createdGroup = await groupRepository.create(groupData);
      const foundGroup = await groupRepository.findByIdAndUserId(createdGroup.id, 'different-user');

      expect(foundGroup).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should find all groups for a user', async () => {
      const groupData1 = {
        userId: 'user-123',
        name: 'Group 1'
      };
      const groupData2 = {
        userId: 'user-123',
        name: 'Group 2'
      };
      const groupData3 = {
        userId: 'different-user',
        name: 'Group 3'
      };

      await groupRepository.create(groupData1);
      await groupRepository.create(groupData2);
      await groupRepository.create(groupData3);

      const groups = await groupRepository.findByUserId('user-123');

      expect(groups).toHaveLength(2);
      expect(groups.every(group => group.userId === 'user-123')).toBe(true);
      expect(groups.map(g => g.name)).toContain('Group 1');
      expect(groups.map(g => g.name)).toContain('Group 2');
    });

    it('should return empty array for user with no groups', async () => {
      const groups = await groupRepository.findByUserId('user-with-no-groups');
      expect(groups).toHaveLength(0);
    });

    it('should order groups by creation date descending by default', async () => {
      const groupData1 = {
        userId: 'user-123',
        name: 'First Group'
      };
      const groupData2 = {
        userId: 'user-123',
        name: 'Second Group'
      };

      const group1 = await groupRepository.create(groupData1);
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      const group2 = await groupRepository.create(groupData2);

      const groups = await groupRepository.findByUserId('user-123');

      expect(groups[0].id).toBe(group2.id); // Most recent first
      expect(groups[1].id).toBe(group1.id);
    });
  });

  describe('findByNameAndUserId', () => {
    it('should find group by name and user ID', async () => {
      const groupData = {
        userId: 'user-123',
        name: 'Test Group'
      };

      await groupRepository.create(groupData);
      const foundGroup = await groupRepository.findByNameAndUserId('Test Group', 'user-123');

      expect(foundGroup).toBeInstanceOf(Group);
      expect(foundGroup.name).toBe('Test Group');
      expect(foundGroup.userId).toBe('user-123');
    });

    it('should return null for non-existent name', async () => {
      const group = await groupRepository.findByNameAndUserId('Non-existent Group', 'user-123');
      expect(group).toBeNull();
    });

    it('should exclude specified ID when provided', async () => {
      const groupData1 = {
        userId: 'user-123',
        name: 'Test Group'
      };
      const groupData2 = {
        userId: 'user-123',
        name: 'Different Group'
      };

      const group1 = await groupRepository.create(groupData1);
      await groupRepository.create(groupData2);

      const foundGroup = await groupRepository.findByNameAndUserId('Test Group', 'user-123', group1.id);
      expect(foundGroup).toBeNull();
    });
  });

  describe('update', () => {
    it('should update group successfully', async () => {
      const groupData = {
        userId: 'user-123',
        name: 'Original Group',
        description: 'Original description',
        color: '#3498db'
      };

      const createdGroup = await groupRepository.create(groupData);
      
      const updateData = {
        name: 'Updated Group',
        description: 'Updated description',
        color: '#e74c3c'
      };

      const updatedGroup = await groupRepository.update(createdGroup.id, updateData);

      expect(updatedGroup).toBeInstanceOf(Group);
      expect(updatedGroup.name).toBe('Updated Group');
      expect(updatedGroup.description).toBe('Updated description');
      expect(updatedGroup.color).toBe('#e74c3c');
      expect(new Date(updatedGroup.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(createdGroup.updatedAt).getTime());
    });

    it('should update only provided fields', async () => {
      const groupData = {
        userId: 'user-123',
        name: 'Original Group',
        description: 'Original description',
        color: '#3498db'
      };

      const createdGroup = await groupRepository.create(groupData);
      
      const updateData = {
        name: 'Updated Group'
      };

      const updatedGroup = await groupRepository.update(createdGroup.id, updateData);

      expect(updatedGroup.name).toBe('Updated Group');
      expect(updatedGroup.description).toBe('Original description');
      expect(updatedGroup.color).toBe('#3498db');
    });

    it('should return null for non-existent group', async () => {
      const updateData = {
        name: 'Updated Group'
      };

      const result = await groupRepository.update('non-existent-id', updateData);
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete group successfully', async () => {
      const groupData = {
        userId: 'user-123',
        name: 'Test Group'
      };

      const createdGroup = await groupRepository.create(groupData);
      const deleteResult = await groupRepository.delete(createdGroup.id);

      expect(deleteResult).toBe(true);

      const foundGroup = await groupRepository.findById(createdGroup.id);
      expect(foundGroup).toBeNull();
    });

    it('should return false for non-existent group', async () => {
      const deleteResult = await groupRepository.delete('non-existent-id');
      expect(deleteResult).toBe(false);
    });
  });

  describe('deleteAndReassignNotes', () => {
    it('should delete group and set notes group_id to null', async () => {
      const db = dbConnection.getDatabase();
      
      // Create group
      const groupData = {
        userId: 'user-123',
        name: 'Test Group'
      };
      const createdGroup = await groupRepository.create(groupData);

      // Create note in the group
      const noteQuery = `
        INSERT INTO notes (id, user_id, group_id, title, description)
        VALUES (?, ?, ?, ?, ?)
      `;
      const noteId = 'note-123';
      db.prepare(noteQuery).run(noteId, 'user-123', createdGroup.id, 'Test Note', 'Test description');

      // Delete group and reassign notes
      const deleteResult = await groupRepository.deleteAndReassignNotes(createdGroup.id);
      expect(deleteResult).toBe(true);

      // Check that group is deleted
      const foundGroup = await groupRepository.findById(createdGroup.id);
      expect(foundGroup).toBeNull();

      // Check that note's group_id is set to null
      const noteRow = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
      expect(noteRow.group_id).toBeNull();
    });
  });

  describe('getCountByUserId', () => {
    it('should return correct count of groups for user', async () => {
      const groupData1 = {
        userId: 'user-123',
        name: 'Group 1'
      };
      const groupData2 = {
        userId: 'user-123',
        name: 'Group 2'
      };
      const groupData3 = {
        userId: 'different-user',
        name: 'Group 3'
      };

      await groupRepository.create(groupData1);
      await groupRepository.create(groupData2);
      await groupRepository.create(groupData3);

      const count = await groupRepository.getCountByUserId('user-123');
      expect(count).toBe(2);
    });

    it('should return 0 for user with no groups', async () => {
      const count = await groupRepository.getCountByUserId('user-with-no-groups');
      expect(count).toBe(0);
    });
  });

  describe('nameExistsForUser', () => {
    it('should return true if name exists for user', async () => {
      const groupData = {
        userId: 'user-123',
        name: 'Test Group'
      };

      await groupRepository.create(groupData);
      const exists = await groupRepository.nameExistsForUser('Test Group', 'user-123');
      expect(exists).toBe(true);
    });

    it('should return false if name does not exist for user', async () => {
      const exists = await groupRepository.nameExistsForUser('Non-existent Group', 'user-123');
      expect(exists).toBe(false);
    });

    it('should exclude specified ID when checking', async () => {
      const groupData = {
        userId: 'user-123',
        name: 'Test Group'
      };

      const createdGroup = await groupRepository.create(groupData);
      const exists = await groupRepository.nameExistsForUser('Test Group', 'user-123', createdGroup.id);
      expect(exists).toBe(false);
    });
  });

  describe('findWithNoteCounts', () => {
    it('should return groups with note counts', async () => {
      const db = dbConnection.getDatabase();
      
      // Create groups
      const groupData1 = {
        userId: 'user-123',
        name: 'Group 1'
      };
      const groupData2 = {
        userId: 'user-123',
        name: 'Group 2'
      };

      const group1 = await groupRepository.create(groupData1);
      const group2 = await groupRepository.create(groupData2);

      // Create notes
      const noteQuery = `
        INSERT INTO notes (id, user_id, group_id, title, status)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      // 2 active notes in group 1
      db.prepare(noteQuery).run('note-1', 'user-123', group1.id, 'Note 1', 'todo');
      db.prepare(noteQuery).run('note-2', 'user-123', group1.id, 'Note 2', 'in_progress');
      
      // 1 active note and 1 done note in group 2 (done notes should not be counted)
      db.prepare(noteQuery).run('note-3', 'user-123', group2.id, 'Note 3', 'todo');
      db.prepare(noteQuery).run('note-4', 'user-123', group2.id, 'Note 4', 'done');

      const groupsWithCounts = await groupRepository.findWithNoteCounts('user-123');

      expect(groupsWithCounts).toHaveLength(2);
      
      const group1WithCount = groupsWithCounts.find(g => g.id === group1.id);
      const group2WithCount = groupsWithCounts.find(g => g.id === group2.id);
      
      expect(group1WithCount.noteCount).toBe(2);
      expect(group2WithCount.noteCount).toBe(1); // Only active notes counted
    });
  });
});