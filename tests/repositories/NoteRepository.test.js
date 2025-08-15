const NoteRepository = require('../../src/repositories/NoteRepository');
const Note = require('../../src/models/Note');
const dbConnection = require('../../src/config/database');

// Mock the database connection
jest.mock('../../src/config/database');

describe('NoteRepository', () => {
  let noteRepository;
  let mockDb;
  let mockPrepare;
  let mockRun;
  let mockGet;
  let mockAll;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock database methods
    mockRun = jest.fn();
    mockGet = jest.fn();
    mockAll = jest.fn();
    mockPrepare = jest.fn(() => ({
      run: mockRun,
      get: mockGet,
      all: mockAll
    }));

    mockDb = {
      prepare: mockPrepare
    };

    dbConnection.getDatabase.mockReturnValue(mockDb);

    noteRepository = new NoteRepository().init();
  });

  describe('Initialization', () => {
    test('should initialize with database connection', () => {
      expect(dbConnection.getDatabase).toHaveBeenCalled();
      expect(noteRepository.db).toBe(mockDb);
    });
  });

  describe('create', () => {
    test('should create a new note successfully', async () => {
      const noteData = {
        userId: 'user123',
        title: 'Test Note',
        description: 'Test Description',
        priority: 'high',
        status: 'todo'
      };

      const mockCreatedNote = {
        id: 'note123',
        user_id: 'user123',
        title: 'Test Note',
        description: 'Test Description',
        priority: 'high',
        status: 'todo',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      mockRun.mockReturnValue({ changes: 1 });
      mockGet.mockReturnValue(mockCreatedNote);

      const result = await noteRepository.create(noteData);

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO notes'));
      expect(mockRun).toHaveBeenCalled();
      expect(mockGet).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Note);
      expect(result.title).toBe('Test Note');
    });

    test('should throw error if note creation fails', async () => {
      const noteData = {
        userId: 'user123',
        title: 'Test Note'
      };

      mockRun.mockReturnValue({ changes: 0 });

      await expect(noteRepository.create(noteData)).rejects.toThrow('Failed to create note');
    });

    test('should generate ID if not provided', async () => {
      const noteData = {
        userId: 'user123',
        title: 'Test Note'
      };

      mockRun.mockReturnValue({ changes: 1 });
      mockGet.mockReturnValue({ id: 'generated123', title: 'Test Note' });

      await noteRepository.create(noteData);

      const insertCall = mockRun.mock.calls[0][0];
      expect(insertCall[0]).toBeTruthy(); // ID should be generated
    });
  });

  describe('findById', () => {
    test('should find note by ID', async () => {
      const mockNote = {
        id: 'note123',
        user_id: 'user123',
        title: 'Test Note'
      };

      mockGet.mockReturnValue(mockNote);

      const result = await noteRepository.findById('note123');

      expect(mockPrepare).toHaveBeenCalledWith('SELECT * FROM notes WHERE id = ?');
      expect(mockGet).toHaveBeenCalledWith('note123');
      expect(result).toBeInstanceOf(Note);
      expect(result.id).toBe('note123');
    });

    test('should return null if note not found', async () => {
      mockGet.mockReturnValue(null);

      const result = await noteRepository.findById('nonexistent');

      expect(result).toBeNull();
    });

    test('should throw error on database error', async () => {
      mockGet.mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(noteRepository.findById('note123')).rejects.toThrow('Failed to find note by ID');
    });
  });

  describe('findByIdAndUserId', () => {
    test('should find note by ID and user ID', async () => {
      const mockNote = {
        id: 'note123',
        user_id: 'user123',
        title: 'Test Note'
      };

      mockGet.mockReturnValue(mockNote);

      const result = await noteRepository.findByIdAndUserId('note123', 'user123');

      expect(mockPrepare).toHaveBeenCalledWith('SELECT * FROM notes WHERE id = ? AND user_id = ?');
      expect(mockGet).toHaveBeenCalledWith('note123', 'user123');
      expect(result).toBeInstanceOf(Note);
    });

    test('should return null if note not found or user not authorized', async () => {
      mockGet.mockReturnValue(null);

      const result = await noteRepository.findByIdAndUserId('note123', 'wronguser');

      expect(result).toBeNull();
    });
  });

  describe('findByUserId', () => {
    test('should find notes by user ID', async () => {
      const mockNotes = [
        { id: 'note1', user_id: 'user123', title: 'Note 1' },
        { id: 'note2', user_id: 'user123', title: 'Note 2' }
      ];

      mockAll.mockReturnValue(mockNotes);

      const result = await noteRepository.findByUserId('user123');

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('WHERE user_id = ?'));
      expect(mockAll).toHaveBeenCalledWith(['user123']);
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Note);
    });

    test('should apply status filter', async () => {
      mockAll.mockReturnValue([]);

      await noteRepository.findByUserId('user123', { status: 'done' });

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('AND status = ?'));
      expect(mockAll).toHaveBeenCalledWith(['user123', 'done']);
    });

    test('should apply priority filter', async () => {
      mockAll.mockReturnValue([]);

      await noteRepository.findByUserId('user123', { priority: 'high' });

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('AND priority = ?'));
      expect(mockAll).toHaveBeenCalledWith(['user123', 'high']);
    });

    test('should apply group filter', async () => {
      mockAll.mockReturnValue([]);

      await noteRepository.findByUserId('user123', { groupId: 'group123' });

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('AND group_id = ?'));
      expect(mockAll).toHaveBeenCalledWith(['user123', 'group123']);
    });

    test('should apply null group filter', async () => {
      mockAll.mockReturnValue([]);

      await noteRepository.findByUserId('user123', { groupId: null });

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('AND group_id IS NULL'));
      expect(mockAll).toHaveBeenCalledWith(['user123']);
    });

    test('should apply search filter', async () => {
      mockAll.mockReturnValue([]);

      await noteRepository.findByUserId('user123', { search: 'test' });

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('AND (title LIKE ? OR description LIKE ?)'));
      expect(mockAll).toHaveBeenCalledWith(['user123', '%test%', '%test%']);
    });

    test('should apply sorting', async () => {
      mockAll.mockReturnValue([]);

      await noteRepository.findByUserId('user123', { sortBy: 'title', sortOrder: 'ASC' });

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('ORDER BY title ASC'));
    });

    test('should apply pagination', async () => {
      mockAll.mockReturnValue([]);

      await noteRepository.findByUserId('user123', { limit: 10, offset: 20 });

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('LIMIT ? OFFSET ?'));
      expect(mockAll).toHaveBeenCalledWith(['user123', 10, 20]);
    });
  });

  describe('findWithPagination', () => {
    test('should return paginated results', async () => {
      const mockNotes = [
        { id: 'note1', user_id: 'user123', title: 'Note 1' }
      ];

      mockGet.mockReturnValue({ count: 25 }); // Total count
      mockAll.mockReturnValue(mockNotes);

      const result = await noteRepository.findWithPagination('user123', { page: 2, limit: 10 });

      expect(result.notes).toHaveLength(1);
      expect(result.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNext: true,
        hasPrev: true
      });
    });

    test('should handle first page', async () => {
      mockGet.mockReturnValue({ count: 5 });
      mockAll.mockReturnValue([]);

      const result = await noteRepository.findWithPagination('user123', { page: 1, limit: 10 });

      expect(result.pagination.hasPrev).toBe(false);
      expect(result.pagination.hasNext).toBe(false);
    });
  });

  describe('update', () => {
    test('should update note successfully', async () => {
      const updateData = {
        title: 'Updated Note',
        priority: 'high'
      };

      const mockUpdatedNote = {
        id: 'note123',
        title: 'Updated Note',
        priority: 'high'
      };

      mockRun.mockReturnValue({ changes: 1 });
      mockGet.mockReturnValue(mockUpdatedNote);

      const result = await noteRepository.update('note123', updateData);

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE notes'));
      expect(mockRun).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Note);
      expect(result.title).toBe('Updated Note');
    });

    test('should return null if note not found', async () => {
      mockRun.mockReturnValue({ changes: 0 });

      const result = await noteRepository.update('nonexistent', { title: 'Updated' });

      expect(result).toBeNull();
    });

    test('should update with empty data (only updatedAt)', async () => {
      // Even with empty update data, updatedAt will be set
      mockRun.mockReturnValue({ changes: 1 });
      mockGet.mockReturnValue({ id: 'note123', updated_at: '2024-01-01T00:00:00Z' });

      const result = await noteRepository.update('note123', {});

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE notes'));
      expect(mockRun).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Note);
    });
  });

  describe('updateStatus', () => {
    test('should update note status successfully', async () => {
      const mockUpdatedNote = {
        id: 'note123',
        status: 'done',
        completed_at: '2024-01-01T00:00:00Z'
      };

      mockRun.mockReturnValue({ changes: 1 });
      mockGet.mockReturnValue(mockUpdatedNote);

      const result = await noteRepository.updateStatus('note123', 'done', 'user123');

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE notes'));
      expect(mockRun).toHaveBeenCalledWith('done', expect.any(String), expect.any(String), 'note123', 'user123');
      expect(result).toBeInstanceOf(Note);
    });

    test('should return null if note not found or user not authorized', async () => {
      mockRun.mockReturnValue({ changes: 0 });

      const result = await noteRepository.updateStatus('note123', 'done', 'wronguser');

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    test('should delete note successfully', async () => {
      mockRun.mockReturnValue({ changes: 1 });

      const result = await noteRepository.delete('note123', 'user123');

      expect(mockPrepare).toHaveBeenCalledWith('DELETE FROM notes WHERE id = ? AND user_id = ?');
      expect(mockRun).toHaveBeenCalledWith('note123', 'user123');
      expect(result).toBe(true);
    });

    test('should return false if note not found or user not authorized', async () => {
      mockRun.mockReturnValue({ changes: 0 });

      const result = await noteRepository.delete('note123', 'wronguser');

      expect(result).toBe(false);
    });
  });

  describe('getStatusCounts', () => {
    test('should return status counts', async () => {
      const mockCounts = [
        { status: 'todo', count: 5 },
        { status: 'in_progress', count: 3 },
        { status: 'done', count: 2 }
      ];

      mockAll.mockReturnValue(mockCounts);

      const result = await noteRepository.getStatusCounts('user123');

      expect(result).toEqual({
        todo: 5,
        in_progress: 3,
        done: 2,
        total: 10
      });
    });

    test('should return zero counts if no notes', async () => {
      mockAll.mockReturnValue([]);

      const result = await noteRepository.getStatusCounts('user123');

      expect(result).toEqual({
        todo: 0,
        in_progress: 0,
        done: 0,
        total: 0
      });
    });
  });

  describe('getPriorityCounts', () => {
    test('should return priority counts', async () => {
      const mockCounts = [
        { priority: 'low', count: 2 },
        { priority: 'medium', count: 5 },
        { priority: 'high', count: 3 }
      ];

      mockAll.mockReturnValue(mockCounts);

      const result = await noteRepository.getPriorityCounts('user123');

      expect(result).toEqual({
        low: 2,
        medium: 5,
        high: 3,
        total: 10
      });
    });
  });

  describe('findByGroupId', () => {
    test('should find notes by group ID', async () => {
      const mockNotes = [
        { id: 'note1', group_id: 'group123', user_id: 'user123' }
      ];

      mockAll.mockReturnValue(mockNotes);

      const result = await noteRepository.findByGroupId('group123', 'user123');

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('WHERE group_id = ? AND user_id = ?'));
      expect(mockAll).toHaveBeenCalledWith('group123', 'user123');
      expect(result).toHaveLength(1);
    });
  });

  describe('clearGroupId', () => {
    test('should clear group ID from notes', async () => {
      mockRun.mockReturnValue({ changes: 3 });

      const result = await noteRepository.clearGroupId('group123', 'user123');

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('SET group_id = NULL'));
      expect(mockRun).toHaveBeenCalledWith(expect.any(String), 'group123', 'user123');
      expect(result).toBe(3);
    });
  });

  describe('getRecentNotes', () => {
    test('should get recent notes', async () => {
      const mockNotes = [
        { id: 'note1', user_id: 'user123', updated_at: '2024-01-02T00:00:00Z' },
        { id: 'note2', user_id: 'user123', updated_at: '2024-01-01T00:00:00Z' }
      ];

      mockAll.mockReturnValue(mockNotes);

      const result = await noteRepository.getRecentNotes('user123', 5);

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('ORDER BY updated_at DESC'));
      expect(mockAll).toHaveBeenCalledWith('user123', 5);
      expect(result).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      mockPrepare.mockImplementation(() => {
        throw new Error('Database connection error');
      });

      await expect(noteRepository.findById('note123')).rejects.toThrow('Failed to find note by ID');
    });
  });

  describe('_generateId', () => {
    test('should generate a unique ID', () => {
      const id1 = noteRepository._generateId();
      const id2 = noteRepository._generateId();

      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^[a-f0-9]{32}$/); // 32 character hex string
    });
  });
});