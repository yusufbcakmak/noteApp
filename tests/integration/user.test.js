const request = require('supertest');
const app = require('../../src/app');
const dbConnection = require('../../src/config/database');
const UserRepository = require('../../src/repositories/UserRepository');

// Set test database to in-memory for tests
process.env.TEST_DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';

describe('User Profile API Integration Tests', () => {
  let userRepository;
  let testUser;
  let authToken;

  beforeAll(async () => {
    // Initialize database connection
    dbConnection.connect();
    userRepository = new UserRepository().init();

    // Create all necessary tables
    const db = dbConnection.getDatabase();
    
    // Create users table
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active INTEGER DEFAULT 1,
        last_login_at DATETIME
      )
    `;
    db.exec(createUsersTable);

    // Create groups table
    const createGroupsTable = `
      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT DEFAULT '#3498db',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `;
    db.exec(createGroupsTable);

    // Create notes table
    const createNotesTable = `
      CREATE TABLE IF NOT EXISTS notes (
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
      )
    `;
    db.exec(createNotesTable);

    // Create completed_notes table
    const createCompletedNotesTable = `
      CREATE TABLE IF NOT EXISTS completed_notes (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL,
        original_note_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        group_name TEXT,
        priority TEXT NOT NULL,
        completed_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `;
    db.exec(createCompletedNotesTable);
  });

  beforeEach(async () => {
    // Clean up database
    const db = dbConnection.getDatabase();
    db.exec('DELETE FROM completed_notes');
    db.exec('DELETE FROM notes');
    db.exec('DELETE FROM groups');
    db.exec('DELETE FROM users');

    // Create test user with unique email to avoid rate limiting
    const uniqueEmail = `test${Date.now()}@example.com`;
    testUser = await userRepository.create({
      email: uniqueEmail,
      password: 'password123',
      firstName: 'Test',
      lastName: 'User'
    });

    // Login to get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: uniqueEmail,
        password: 'password123'
      });

    if (loginResponse.status !== 200) {
      console.log('Login failed. Response:', JSON.stringify(loginResponse.body, null, 2));
      throw new Error('Login failed in test setup');
    }

    authToken = loginResponse.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    dbConnection.close();
  });

  describe('GET /api/user/profile', () => {
    it('should get user profile successfully', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.profile).toMatchObject({
        id: testUser.id,
        email: testUser.email,
        firstName: 'Test',
        lastName: 'User'
      });
      expect(response.body.data.profile.password).toBeUndefined();
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_FAILED');
    });
  });

  describe('PUT /api/user/profile', () => {
    it('should update user profile successfully', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        email: 'updated@example.com'
      };

      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.profile).toMatchObject({
        firstName: 'Updated',
        lastName: 'Name',
        email: 'updated@example.com'
      });
      expect(response.body.message).toBe('Profile updated successfully');
    });

    it('should update password successfully', async () => {
      const updateData = {
        currentPassword: 'password123',
        newPassword: 'newpassword123'
      };

      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile updated successfully');

      // Verify new password works
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'newpassword123'
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
    });

    it('should return 400 for invalid current password', async () => {
      const updateData = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123'
      };

      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
    });

    it('should return 400 for invalid email format', async () => {
      const updateData = {
        email: 'invalid-email'
      };

      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toContain('Invalid email format');
    });

    it('should return 400 for short password', async () => {
      const updateData = {
        currentPassword: 'password123',
        newPassword: '123'
      };

      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toContain('New password must be at least 6 characters long');
    });

    it('should return 409 for duplicate email', async () => {
      // Create another user
      await userRepository.create({
        email: 'another@example.com',
        password: 'password123',
        firstName: 'Another',
        lastName: 'User'
      });

      const updateData = {
        email: 'another@example.com'
      };

      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .put('/api/user/profile')
        .send({ firstName: 'Updated' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('DELETE /api/user/account', () => {
    it('should delete user account successfully', async () => {
      const deleteData = {
        password: 'password123',
        confirmation: 'DELETE_MY_ACCOUNT'
      };

      const response = await request(app)
        .delete('/api/user/account')
        .set('Authorization', `Bearer ${authToken}`)
        .send(deleteData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Account deleted successfully');

      // Verify user is deleted
      const deletedUser = await userRepository.findById(testUser.id);
      expect(deletedUser).toBeNull();
    });

    it('should return 400 for invalid password', async () => {
      const deleteData = {
        password: 'wrongpassword',
        confirmation: 'DELETE_MY_ACCOUNT'
      };

      const response = await request(app)
        .delete('/api/user/account')
        .set('Authorization', `Bearer ${authToken}`)
        .send(deleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_PASSWORD');
    });

    it('should return 400 for invalid confirmation', async () => {
      const deleteData = {
        password: 'password123',
        confirmation: 'WRONG_CONFIRMATION'
      };

      const response = await request(app)
        .delete('/api/user/account')
        .set('Authorization', `Bearer ${authToken}`)
        .send(deleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toContain('Confirmation must be exactly "DELETE_MY_ACCOUNT"');
    });

    it('should return 400 for missing password', async () => {
      const deleteData = {
        confirmation: 'DELETE_MY_ACCOUNT'
      };

      const response = await request(app)
        .delete('/api/user/account')
        .set('Authorization', `Bearer ${authToken}`)
        .send(deleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toContain('Password is required for account deletion');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .delete('/api/user/account')
        .send({
          password: 'password123',
          confirmation: 'DELETE_MY_ACCOUNT'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('Cascade deletion', () => {
    it('should delete all user data when account is deleted', async () => {
      const db = dbConnection.getDatabase();

      // Create some test data for the user
      const groupQuery = `
        INSERT INTO groups (id, user_id, name, description)
        VALUES ('group1', ?, 'Test Group', 'Test Description')
      `;
      db.prepare(groupQuery).run(testUser.id);

      const noteQuery = `
        INSERT INTO notes (id, user_id, group_id, title, description, status, priority)
        VALUES ('note1', ?, 'group1', 'Test Note', 'Test Description', 'todo', 'medium')
      `;
      db.prepare(noteQuery).run(testUser.id);

      const completedNoteQuery = `
        INSERT INTO completed_notes (id, user_id, original_note_id, title, description, group_name, priority, completed_at, created_at)
        VALUES ('completed1', ?, 'note1', 'Completed Note', 'Test Description', 'Test Group', 'medium', datetime('now'), datetime('now'))
      `;
      db.prepare(completedNoteQuery).run(testUser.id);

      // Verify data exists
      const groupCount = db.prepare('SELECT COUNT(*) as count FROM groups WHERE user_id = ?').get(testUser.id);
      const noteCount = db.prepare('SELECT COUNT(*) as count FROM notes WHERE user_id = ?').get(testUser.id);
      const completedNoteCount = db.prepare('SELECT COUNT(*) as count FROM completed_notes WHERE user_id = ?').get(testUser.id);

      expect(groupCount.count).toBe(1);
      expect(noteCount.count).toBe(1);
      expect(completedNoteCount.count).toBe(1);

      // Delete account
      const deleteData = {
        password: 'password123',
        confirmation: 'DELETE_MY_ACCOUNT'
      };

      await request(app)
        .delete('/api/user/account')
        .set('Authorization', `Bearer ${authToken}`)
        .send(deleteData)
        .expect(200);

      // Verify all data is deleted due to CASCADE
      const groupCountAfter = db.prepare('SELECT COUNT(*) as count FROM groups WHERE user_id = ?').get(testUser.id);
      const noteCountAfter = db.prepare('SELECT COUNT(*) as count FROM notes WHERE user_id = ?').get(testUser.id);
      const completedNoteCountAfter = db.prepare('SELECT COUNT(*) as count FROM completed_notes WHERE user_id = ?').get(testUser.id);

      expect(groupCountAfter.count).toBe(0);
      expect(noteCountAfter.count).toBe(0);
      expect(completedNoteCountAfter.count).toBe(0);
    });
  });
});