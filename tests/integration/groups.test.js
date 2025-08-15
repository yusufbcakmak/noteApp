const request = require('supertest');
const app = require('../../src/app');
const dbConnection = require('../../src/config/database');
const UserRepository = require('../../src/repositories/UserRepository');
const GroupRepository = require('../../src/repositories/GroupRepository');
const jwtUtils = require('../../src/utils/jwt');

describe('Group API Integration Tests', () => {
  let userRepository;
  let groupRepository;
  let testUser;
  let authToken;
  let testGroup;

  beforeAll(async () => {
    // Initialize database connection
    dbConnection.connect();
    
    // Initialize repositories
    userRepository = new UserRepository().init();
    groupRepository = new GroupRepository().init();
  });

  beforeEach(async () => {
    // Clean up database
    const db = dbConnection.getDatabase();
    db.exec('DELETE FROM notes');
    db.exec('DELETE FROM groups');
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

    // Create test group
    testGroup = await groupRepository.create({
      userId: testUser.id,
      name: 'Test Group',
      description: 'Test description',
      color: '#3498db'
    });
  });

  afterAll(async () => {
    // Close database connection
    dbConnection.close();
  });

  describe('GET /api/groups', () => {
    it('should get all groups for authenticated user', async () => {
      const response = await request(app)
        .get('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(testGroup.id);
      expect(response.body.data[0].name).toBe('Test Group');
      expect(response.body.data[0].userId).toBe(testUser.id);
    });

    it('should return empty array for user with no groups', async () => {
      // Delete the test group
      await groupRepository.delete(testGroup.id);

      const response = await request(app)
        .get('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });

    it('should support pagination', async () => {
      // Create additional groups
      await groupRepository.create({
        userId: testUser.id,
        name: 'Group 2',
        description: 'Second group'
      });

      const response = await request(app)
        .get('/api/groups?page=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.groups).toHaveLength(1);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(1);
      expect(response.body.data.pagination.total).toBe(2);
    });

    it('should support search functionality', async () => {
      // Create additional group
      await groupRepository.create({
        userId: testUser.id,
        name: 'Work Tasks',
        description: 'Work related tasks'
      });

      const response = await request(app)
        .get('/api/groups?search=Tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Work Tasks');
    });

    it('should include note counts when requested', async () => {
      const response = await request(app)
        .get('/api/groups?includeNoteCounts=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toHaveProperty('noteCount');
      expect(response.body.data[0].noteCount).toBe(0);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/groups')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('GET /api/groups/:id', () => {
    it('should get specific group by ID', async () => {
      const response = await request(app)
        .get(`/api/groups/${testGroup.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testGroup.id);
      expect(response.body.data.name).toBe('Test Group');
      expect(response.body.data.description).toBe('Test description');
    });

    it('should return 404 for non-existent group', async () => {
      const response = await request(app)
        .get('/api/groups/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('GROUP_NOT_FOUND');
    });

    it('should not allow access to other users groups', async () => {
      // Create another user
      const otherUser = await userRepository.create({
        email: 'other@example.com',
        password: 'hashedpassword123',
        firstName: 'Other',
        lastName: 'User'
      });

      // Create group for other user
      const otherGroup = await groupRepository.create({
        userId: otherUser.id,
        name: 'Other Group',
        description: 'Other user group'
      });

      const response = await request(app)
        .get(`/api/groups/${otherGroup.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('GROUP_NOT_FOUND');
    });
  });

  describe('POST /api/groups', () => {
    it('should create a new group', async () => {
      const groupData = {
        name: 'New Group',
        description: 'New group description',
        color: '#e74c3c'
      };

      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send(groupData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('New Group');
      expect(response.body.data.description).toBe('New group description');
      expect(response.body.data.color).toBe('#e74c3c');
      expect(response.body.data.userId).toBe(testUser.id);
      expect(response.body.message).toBe('Group created successfully');
    });

    it('should create group with minimal data', async () => {
      const groupData = {
        name: 'Minimal Group'
      };

      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send(groupData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Minimal Group');
      expect(response.body.data.color).toBe('#3498db'); // Default color
    });

    it('should reject invalid group data', async () => {
      const invalidData = {
        name: '', // Empty name
        color: 'invalid-color'
      };

      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toBeDefined();
    });

    it('should reject duplicate group names for same user', async () => {
      const groupData = {
        name: 'Test Group' // Same name as existing group
      };

      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send(groupData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('GROUP_NAME_EXISTS');
    });

    it('should allow same group name for different users', async () => {
      // Create another user
      const otherUser = await userRepository.create({
        email: 'other@example.com',
        password: 'hashedpassword123',
        firstName: 'Other',
        lastName: 'User'
      });

      const otherTokenPayload = {
        userId: otherUser.id,
        email: otherUser.email,
        firstName: otherUser.firstName,
        lastName: otherUser.lastName
      };
      const otherAuthToken = jwtUtils.generateAccessToken(otherTokenPayload);

      const groupData = {
        name: 'Test Group' // Same name as existing group but different user
      };

      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${otherAuthToken}`)
        .send(groupData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Group');
    });
  });

  describe('PUT /api/groups/:id', () => {
    it('should update existing group', async () => {
      const updateData = {
        name: 'Updated Group',
        description: 'Updated description',
        color: '#2ecc71'
      };

      const response = await request(app)
        .put(`/api/groups/${testGroup.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Group');
      expect(response.body.data.description).toBe('Updated description');
      expect(response.body.data.color).toBe('#2ecc71');
      expect(response.body.message).toBe('Group updated successfully');
    });

    it('should update only provided fields', async () => {
      const updateData = {
        name: 'Partially Updated'
      };

      const response = await request(app)
        .put(`/api/groups/${testGroup.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Partially Updated');
      expect(response.body.data.description).toBe('Test description'); // Unchanged
      expect(response.body.data.color).toBe('#3498db'); // Unchanged
    });

    it('should return 404 for non-existent group', async () => {
      const updateData = {
        name: 'Updated Group'
      };

      const response = await request(app)
        .put('/api/groups/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('GROUP_NOT_FOUND');
    });

    it('should reject invalid update data', async () => {
      const invalidData = {
        name: '',
        color: 'invalid-color'
      };

      const response = await request(app)
        .put(`/api/groups/${testGroup.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject duplicate name updates', async () => {
      // Create another group
      await groupRepository.create({
        userId: testUser.id,
        name: 'Another Group'
      });

      const updateData = {
        name: 'Another Group' // Trying to use existing name
      };

      const response = await request(app)
        .put(`/api/groups/${testGroup.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('GROUP_NAME_EXISTS');
    });
  });

  describe('DELETE /api/groups/:id', () => {
    it('should delete existing group', async () => {
      const response = await request(app)
        .delete(`/api/groups/${testGroup.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Group deleted successfully');

      // Verify group is deleted
      const deletedGroup = await groupRepository.findById(testGroup.id);
      expect(deletedGroup).toBeNull();
    });

    it('should return 404 for non-existent group', async () => {
      const response = await request(app)
        .delete('/api/groups/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('GROUP_NOT_FOUND');
    });

    it('should reassign notes when deleting group', async () => {
      const db = dbConnection.getDatabase();
      
      // Create a note in the group
      const noteQuery = `
        INSERT INTO notes (id, user_id, group_id, title, description)
        VALUES (?, ?, ?, ?, ?)
      `;
      const noteId = 'test-note-123';
      db.prepare(noteQuery).run(noteId, testUser.id, testGroup.id, 'Test Note', 'Test description');

      const response = await request(app)
        .delete(`/api/groups/${testGroup.id}?reassignNotes=true`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify note's group_id is set to null
      const noteRow = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
      expect(noteRow.group_id).toBeNull();
    });
  });

  describe('GET /api/groups/stats', () => {
    it('should get group statistics', async () => {
      const response = await request(app)
        .get('/api/groups/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalGroups');
      expect(response.body.data).toHaveProperty('totalNotes');
      expect(response.body.data).toHaveProperty('averageNotesPerGroup');
      expect(response.body.data).toHaveProperty('groupsWithCounts');
      expect(response.body.data.totalGroups).toBe(1);
    });

    it('should return zero stats for user with no groups', async () => {
      // Delete the test group
      await groupRepository.delete(testGroup.id);

      const response = await request(app)
        .get('/api/groups/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalGroups).toBe(0);
      expect(response.body.data.totalNotes).toBe(0);
      expect(response.body.data.averageNotesPerGroup).toBe(0);
    });
  });
});