const request = require('supertest');
const app = require('../../src/app');
const dbConnection = require('../../src/config/database');
const UserRepository = require('../../src/repositories/UserRepository');
const NoteRepository = require('../../src/repositories/NoteRepository');
const jwtUtils = require('../../src/utils/jwt');

describe('Note API Integration Tests', () => {
  let userRepository;
  let noteRepository;
  let testUser;
  let authToken;
  let testNote;

  beforeAll(async () => {
    // Initialize database connection
    dbConnection.connect();
    
    // Initialize repositories
    userRepository = new UserRepository().init();
    noteRepository = new NoteRepository().init();
  });

  beforeEach(async () => {
    // Clean up database
    const db = dbConnection.getDatabase();
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

    // Create test note
    testNote = await noteRepository.create({
      userId: testUser.id,
      title: 'Test Note',
      description: 'Test description',
      status: 'todo',
      priority: 'medium'
    });
  });

  afterAll(async () => {
    // Clean up and close database connection
    const db = dbConnection.getDatabase();
    db.exec('DELETE FROM notes');
    db.exec('DELETE FROM users');
    dbConnection.close();
  });

  describe('GET /api/notes', () => {
    it('should get all notes for authenticated user', async () => {
      const response = await request(app)
        .get('/api/notes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.notes).toHaveLength(1);
      expect(response.body.data.notes[0].title).toBe('Test Note');
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.total).toBe(1);
    });

    it('should filter notes by status', async () => {
      // Create additional notes with different statuses
      await noteRepository.create({
        userId: testUser.id,
        title: 'In Progress Note',
        status: 'in_progress',
        priority: 'high'
      });

      await noteRepository.create({
        userId: testUser.id,
        title: 'Done Note',
        status: 'done',
        priority: 'low'
      });

      const response = await request(app)
        .get('/api/notes?status=in_progress')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.notes).toHaveLength(1);
      expect(response.body.data.notes[0].status).toBe('in_progress');
    });

    it('should filter notes by priority', async () => {
      // Create additional note with high priority
      await noteRepository.create({
        userId: testUser.id,
        title: 'High Priority Note',
        status: 'todo',
        priority: 'high'
      });

      const response = await request(app)
        .get('/api/notes?priority=high')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.notes).toHaveLength(1);
      expect(response.body.data.notes[0].priority).toBe('high');
    });

    it('should search notes by title and description', async () => {
      // Create additional note
      await noteRepository.create({
        userId: testUser.id,
        title: 'Shopping List',
        description: 'Buy groceries and household items',
        status: 'todo',
        priority: 'medium'
      });

      const response = await request(app)
        .get('/api/notes?search=shopping')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.notes).toHaveLength(1);
      expect(response.body.data.notes[0].title).toBe('Shopping List');
    });

    it('should paginate notes correctly', async () => {
      // Create multiple notes
      for (let i = 1; i <= 15; i++) {
        await noteRepository.create({
          userId: testUser.id,
          title: `Note ${i}`,
          description: `Description ${i}`,
          status: 'todo',
          priority: 'medium'
        });
      }

      const response = await request(app)
        .get('/api/notes?page=2&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.notes).toHaveLength(5);
      expect(response.body.data.pagination.page).toBe(2);
      expect(response.body.data.pagination.limit).toBe(5);
      expect(response.body.data.pagination.total).toBe(16); // 15 + original test note
      expect(response.body.data.pagination.totalPages).toBe(4);
    });

    it('should sort notes by different fields', async () => {
      // Create additional note
      await noteRepository.create({
        userId: testUser.id,
        title: 'A First Note',
        description: 'This should come first alphabetically',
        status: 'todo',
        priority: 'high'
      });

      const response = await request(app)
        .get('/api/notes?sortBy=title&sortOrder=ASC')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.notes).toHaveLength(2);
      expect(response.body.data.notes[0].title).toBe('A First Note');
      expect(response.body.data.notes[1].title).toBe('Test Note');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/notes')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should not return notes from other users', async () => {
      // Create another user
      const otherUser = await userRepository.create({
        email: 'other@example.com',
        password: 'hashedpassword123',
        firstName: 'Other',
        lastName: 'User'
      });

      // Create note for other user
      await noteRepository.create({
        userId: otherUser.id,
        title: 'Other User Note',
        description: 'This should not be visible',
        status: 'todo',
        priority: 'medium'
      });

      const response = await request(app)
        .get('/api/notes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.notes).toHaveLength(1);
      expect(response.body.data.notes[0].title).toBe('Test Note');
    });
  });

  describe('GET /api/notes/:id', () => {
    it('should get a specific note by ID', async () => {
      const response = await request(app)
        .get(`/api/notes/${testNote.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testNote.id);
      expect(response.body.data.title).toBe('Test Note');
    });

    it('should return 404 for non-existent note', async () => {
      const response = await request(app)
        .get('/api/notes/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOTE_NOT_FOUND');
    });

    it('should not allow access to other users notes', async () => {
      // Create another user and their note
      const otherUser = await userRepository.create({
        email: 'other@example.com',
        password: 'hashedpassword123',
        firstName: 'Other',
        lastName: 'User'
      });

      const otherNote = await noteRepository.create({
        userId: otherUser.id,
        title: 'Other User Note',
        description: 'Private note',
        status: 'todo',
        priority: 'medium'
      });

      const response = await request(app)
        .get(`/api/notes/${otherNote.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOTE_NOT_FOUND');
    });
  });

  describe('POST /api/notes', () => {
    it('should create a new note', async () => {
      const noteData = {
        title: 'New Note',
        description: 'New note description',
        priority: 'high',
        status: 'todo'
      };

      const response = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(noteData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('New Note');
      expect(response.body.data.description).toBe('New note description');
      expect(response.body.data.priority).toBe('high');
      expect(response.body.data.status).toBe('todo');
      expect(response.body.data.userId).toBe(testUser.id);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.createdAt).toBeDefined();
    });

    it('should create note with minimal data', async () => {
      const noteData = {
        title: 'Minimal Note'
      };

      const response = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(noteData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Minimal Note');
      expect(response.body.data.priority).toBe('medium'); // default
      expect(response.body.data.status).toBe('todo'); // default
    });

    it('should validate required fields', async () => {
      const noteData = {
        description: 'Note without title'
      };

      const response = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(noteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'title',
            message: 'Title is required'
          })
        ])
      );
    });

    it('should validate field lengths', async () => {
      const noteData = {
        title: 'a'.repeat(256), // Too long
        description: 'b'.repeat(2001) // Too long
      };

      const response = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(noteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.length).toBeGreaterThan(0);
    });

    it('should validate enum values', async () => {
      const noteData = {
        title: 'Test Note',
        priority: 'invalid_priority',
        status: 'invalid_status'
      };

      const response = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(noteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PUT /api/notes/:id', () => {
    it('should update an existing note', async () => {
      const updateData = {
        title: 'Updated Note',
        description: 'Updated description',
        priority: 'high',
        status: 'in_progress'
      };

      const response = await request(app)
        .put(`/api/notes/${testNote.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated Note');
      expect(response.body.data.description).toBe('Updated description');
      expect(response.body.data.priority).toBe('high');
      expect(response.body.data.status).toBe('in_progress');
      expect(response.body.data.updatedAt).toBeDefined();
    });

    it('should update partial note data', async () => {
      const updateData = {
        title: 'Partially Updated Note'
      };

      const response = await request(app)
        .put(`/api/notes/${testNote.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Partially Updated Note');
      expect(response.body.data.description).toBe('Test description'); // unchanged
      expect(response.body.data.priority).toBe('medium'); // unchanged
    });

    it('should set completion timestamp when status changes to done', async () => {
      const updateData = {
        status: 'done'
      };

      const response = await request(app)
        .put(`/api/notes/${testNote.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('done');
      expect(response.body.data.completedAt).toBeDefined();
      expect(new Date(response.body.data.completedAt)).toBeInstanceOf(Date);
    });

    it('should clear completion timestamp when status changes from done', async () => {
      // First set to done
      await noteRepository.updateStatus(testNote.id, 'done', testUser.id);

      const updateData = {
        status: 'in_progress'
      };

      const response = await request(app)
        .put(`/api/notes/${testNote.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('in_progress');
      expect(response.body.data.completedAt).toBeNull();
    });

    it('should return 404 for non-existent note', async () => {
      const updateData = {
        title: 'Updated Note'
      };

      const response = await request(app)
        .put('/api/notes/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOTE_NOT_FOUND');
    });

    it('should not allow updating other users notes', async () => {
      // Create another user and their note
      const otherUser = await userRepository.create({
        email: 'other@example.com',
        password: 'hashedpassword123',
        firstName: 'Other',
        lastName: 'User'
      });

      const otherNote = await noteRepository.create({
        userId: otherUser.id,
        title: 'Other User Note',
        description: 'Private note',
        status: 'todo',
        priority: 'medium'
      });

      const updateData = {
        title: 'Hacked Note'
      };

      const response = await request(app)
        .put(`/api/notes/${otherNote.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOTE_NOT_FOUND');
    });

    it('should validate update data', async () => {
      const updateData = {
        title: '', // Empty title
        priority: 'invalid_priority'
      };

      const response = await request(app)
        .put(`/api/notes/${testNote.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PATCH /api/notes/:id/status', () => {
    it('should update note status', async () => {
      const statusData = {
        status: 'in_progress'
      };

      const response = await request(app)
        .patch(`/api/notes/${testNote.id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(statusData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('in_progress');
      expect(response.body.data.updatedAt).toBeDefined();
    });

    it('should set completion timestamp when status changes to done', async () => {
      const statusData = {
        status: 'done'
      };

      const response = await request(app)
        .patch(`/api/notes/${testNote.id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(statusData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('done');
      expect(response.body.data.completedAt).toBeDefined();
    });

    it('should archive note when status changes to done', async () => {
      const statusData = {
        status: 'done'
      };

      const response = await request(app)
        .patch(`/api/notes/${testNote.id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(statusData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('done');

      // Check if note was archived by querying the database directly
      const db = dbConnection.getDatabase();
      const archivedNote = db.prepare(`
        SELECT * FROM completed_notes 
        WHERE original_note_id = ? AND user_id = ?
      `).get(testNote.id, testUser.id);

      expect(archivedNote).toBeDefined();
      expect(archivedNote.title).toBe(testNote.title);
      expect(archivedNote.priority).toBe(testNote.priority);
    });

    it('should handle status transitions correctly', async () => {
      // First move to in_progress
      await request(app)
        .patch(`/api/notes/${testNote.id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'in_progress' })
        .expect(200);

      // Then move to done
      const response = await request(app)
        .patch(`/api/notes/${testNote.id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'done' })
        .expect(200);

      expect(response.body.data.status).toBe('done');
      expect(response.body.data.completedAt).toBeDefined();

      // Move back to in_progress (should clear completion timestamp)
      const backResponse = await request(app)
        .patch(`/api/notes/${testNote.id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'in_progress' })
        .expect(200);

      expect(backResponse.body.data.status).toBe('in_progress');
      expect(backResponse.body.data.completedAt).toBeNull();
    });

    it('should not archive note multiple times', async () => {
      // Mark as done first time
      await request(app)
        .patch(`/api/notes/${testNote.id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'done' })
        .expect(200);

      // Move back to todo
      await request(app)
        .patch(`/api/notes/${testNote.id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'todo' })
        .expect(200);

      // Mark as done again
      await request(app)
        .patch(`/api/notes/${testNote.id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'done' })
        .expect(200);

      // Should only have one archived record
      const db = dbConnection.getDatabase();
      const archivedNotes = db.prepare(`
        SELECT COUNT(*) as count FROM completed_notes 
        WHERE original_note_id = ? AND user_id = ?
      `).get(testNote.id, testUser.id);

      expect(archivedNotes.count).toBe(1);
    });

    it('should validate status value', async () => {
      const statusData = {
        status: 'invalid_status'
      };

      const response = await request(app)
        .patch(`/api/notes/${testNote.id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(statusData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should require status field', async () => {
      const response = await request(app)
        .patch(`/api/notes/${testNote.id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent note', async () => {
      const statusData = {
        status: 'done'
      };

      const response = await request(app)
        .patch('/api/notes/nonexistent/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send(statusData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOTE_NOT_FOUND');
    });

    it('should not allow updating other users notes status', async () => {
      // Create another user and their note
      const otherUser = await userRepository.create({
        email: 'other@example.com',
        password: 'hashedpassword123',
        firstName: 'Other',
        lastName: 'User'
      });

      const otherNote = await noteRepository.create({
        userId: otherUser.id,
        title: 'Other User Note',
        description: 'Private note',
        status: 'todo',
        priority: 'medium'
      });

      const statusData = {
        status: 'done'
      };

      const response = await request(app)
        .patch(`/api/notes/${otherNote.id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(statusData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOTE_NOT_FOUND');
    });
  });

  describe('DELETE /api/notes/:id', () => {
    it('should delete an existing note', async () => {
      const response = await request(app)
        .delete(`/api/notes/${testNote.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Note deleted successfully');

      // Verify note is deleted
      const getResponse = await request(app)
        .get(`/api/notes/${testNote.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(getResponse.body.error.code).toBe('NOTE_NOT_FOUND');
    });

    it('should return 404 for non-existent note', async () => {
      const response = await request(app)
        .delete('/api/notes/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOTE_NOT_FOUND');
    });

    it('should not allow deleting other users notes', async () => {
      // Create another user and their note
      const otherUser = await userRepository.create({
        email: 'other@example.com',
        password: 'hashedpassword123',
        firstName: 'Other',
        lastName: 'User'
      });

      const otherNote = await noteRepository.create({
        userId: otherUser.id,
        title: 'Other User Note',
        description: 'Private note',
        status: 'todo',
        priority: 'medium'
      });

      const response = await request(app)
        .delete(`/api/notes/${otherNote.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOTE_NOT_FOUND');
    });
  });

  describe('GET /api/notes/stats', () => {
    beforeEach(async () => {
      // Create notes with different statuses and priorities
      await noteRepository.create({
        userId: testUser.id,
        title: 'High Priority Todo',
        status: 'todo',
        priority: 'high'
      });

      await noteRepository.create({
        userId: testUser.id,
        title: 'In Progress Note',
        status: 'in_progress',
        priority: 'medium'
      });

      await noteRepository.create({
        userId: testUser.id,
        title: 'Done Note',
        status: 'done',
        priority: 'low'
      });
    });

    it('should get note statistics', async () => {
      const response = await request(app)
        .get('/api/notes/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.statusCounts).toBeDefined();
      expect(response.body.data.priorityCounts).toBeDefined();

      // Check status counts (including original test note)
      expect(response.body.data.statusCounts.todo).toBe(2);
      expect(response.body.data.statusCounts.in_progress).toBe(1);
      expect(response.body.data.statusCounts.done).toBe(1);
      expect(response.body.data.statusCounts.total).toBe(4);

      // Check priority counts
      expect(response.body.data.priorityCounts.high).toBe(1);
      expect(response.body.data.priorityCounts.medium).toBe(2);
      expect(response.body.data.priorityCounts.low).toBe(1);
      expect(response.body.data.priorityCounts.total).toBe(4);
    });
  });

  describe('GET /api/notes/recent', () => {
    beforeEach(async () => {
      // Create multiple notes with different timestamps
      for (let i = 1; i <= 10; i++) {
        await noteRepository.create({
          userId: testUser.id,
          title: `Recent Note ${i}`,
          description: `Description ${i}`,
          status: 'todo',
          priority: 'medium'
        });
      }
    });

    it('should get recent notes', async () => {
      const response = await request(app)
        .get('/api/notes/recent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(5); // default limit
      expect(response.body.data[0].title).toMatch(/Recent Note/);
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/notes/recent?limit=3')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
    });

    it('should limit maximum recent notes to 20', async () => {
      const response = await request(app)
        .get('/api/notes/recent?limit=50')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(20);
    });
  });
});