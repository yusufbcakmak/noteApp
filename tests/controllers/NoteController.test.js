// Mock dependencies before importing
jest.mock('../../src/repositories/NoteRepository');
jest.mock('../../src/services/HistoryService');

const NoteController = require('../../src/controllers/NoteController');
const NoteRepository = require('../../src/repositories/NoteRepository');
const HistoryService = require('../../src/services/HistoryService');
const { ValidationError, NotFoundError } = require('../../src/utils/errors');

describe('NoteController', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      user: { id: 'user-123' },
      params: {},
      query: {},
      body: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('getAllNotes', () => {
    it('should get all notes successfully', async () => {
      const mockNotes = [
        { id: 'note-1', title: 'Test Note 1', userId: 'user-123' },
        { id: 'note-2', title: 'Test Note 2', userId: 'user-123' }
      ];
      const mockPagination = { page: 1, limit: 10, total: 2, totalPages: 1 };

      NoteRepository.findByUserId.mockResolvedValue({ notes: mockNotes, pagination: mockPagination });

      await NoteController.getAllNotes(mockReq, mockRes, mockNext);

      expect(NoteRepository.findByUserId).toHaveBeenCalledWith('user-123', {});
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          notes: mockNotes,
          pagination: mockPagination
        }
      });
    });

    it('should handle query parameters', async () => {
      mockReq.query = {
        status: 'todo',
        priority: 'high',
        search: 'test',
        page: '2',
        limit: '5'
      };

      const mockNotes = [];
      const mockPagination = { page: 2, limit: 5, total: 0, totalPages: 0 };

      NoteRepository.findByUserId.mockResolvedValue({ notes: mockNotes, pagination: mockPagination });

      await NoteController.getAllNotes(mockReq, mockRes, mockNext);

      expect(NoteRepository.findByUserId).toHaveBeenCalledWith('user-123', {
        status: 'todo',
        priority: 'high',
        search: 'test',
        page: 2,
        limit: 5
      });
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      NoteRepository.findByUserId.mockRejectedValue(error);

      await NoteController.getAllNotes(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getNoteById', () => {
    it('should get note by id successfully', async () => {
      const mockNote = { id: 'note-1', title: 'Test Note', userId: 'user-123' };
      mockReq.params.id = 'note-1';

      NoteRepository.findById.mockResolvedValue(mockNote);

      await NoteController.getNoteById(mockReq, mockRes, mockNext);

      expect(NoteRepository.findById).toHaveBeenCalledWith('note-1');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockNote
      });
    });

    it('should return 404 for non-existent note', async () => {
      mockReq.params.id = 'non-existent';
      NoteRepository.findById.mockResolvedValue(null);

      await NoteController.getNoteById(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
    });

    it('should return 404 for note belonging to different user', async () => {
      const mockNote = { id: 'note-1', title: 'Test Note', userId: 'other-user' };
      mockReq.params.id = 'note-1';

      NoteRepository.findById.mockResolvedValue(mockNote);

      await NoteController.getNoteById(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
    });
  });

  describe('createNote', () => {
    it('should create note successfully', async () => {
      const noteData = {
        title: 'New Note',
        description: 'Note description',
        priority: 'high'
      };
      const mockNote = { id: 'note-1', ...noteData, userId: 'user-123' };

      mockReq.body = noteData;
      NoteRepository.create.mockResolvedValue(mockNote);

      await NoteController.createNote(mockReq, mockRes, mockNext);

      expect(NoteRepository.create).toHaveBeenCalledWith({
        ...noteData,
        userId: 'user-123'
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Note created successfully',
        data: mockNote
      });
    });

    it('should handle creation errors', async () => {
      const error = new ValidationError('Title is required');
      NoteRepository.create.mockRejectedValue(error);

      mockReq.body = { description: 'No title' };

      await NoteController.createNote(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('updateNote', () => {
    it('should update note successfully', async () => {
      const updateData = { title: 'Updated Note', priority: 'low' };
      const existingNote = { id: 'note-1', title: 'Old Note', userId: 'user-123' };
      const updatedNote = { ...existingNote, ...updateData };

      mockReq.params.id = 'note-1';
      mockReq.body = updateData;

      NoteRepository.findById.mockResolvedValue(existingNote);
      NoteRepository.update.mockResolvedValue(updatedNote);

      await NoteController.updateNote(mockReq, mockRes, mockNext);

      expect(NoteRepository.findById).toHaveBeenCalledWith('note-1');
      expect(NoteRepository.update).toHaveBeenCalledWith('note-1', updateData);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Note updated successfully',
        data: updatedNote
      });
    });

    it('should handle status change to done', async () => {
      const updateData = { status: 'done' };
      const existingNote = { id: 'note-1', title: 'Test Note', userId: 'user-123', status: 'todo' };
      const updatedNote = { ...existingNote, ...updateData, completedAt: new Date().toISOString() };

      mockReq.params.id = 'note-1';
      mockReq.body = updateData;

      NoteRepository.findById.mockResolvedValue(existingNote);
      NoteRepository.update.mockResolvedValue(updatedNote);
      HistoryService.archiveNote.mockResolvedValue();

      await NoteController.updateNote(mockReq, mockRes, mockNext);

      expect(HistoryService.archiveNote).toHaveBeenCalledWith(updatedNote);
    });

    it('should return 404 for non-existent note', async () => {
      mockReq.params.id = 'non-existent';
      mockReq.body = { title: 'Updated' };

      NoteRepository.findById.mockResolvedValue(null);

      await NoteController.updateNote(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
    });
  });

  describe('deleteNote', () => {
    it('should delete note successfully', async () => {
      const existingNote = { id: 'note-1', title: 'Test Note', userId: 'user-123' };

      mockReq.params.id = 'note-1';
      NoteRepository.findById.mockResolvedValue(existingNote);
      NoteRepository.delete.mockResolvedValue(true);

      await NoteController.deleteNote(mockReq, mockRes, mockNext);

      expect(NoteRepository.findById).toHaveBeenCalledWith('note-1');
      expect(NoteRepository.delete).toHaveBeenCalledWith('note-1');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Note deleted successfully'
      });
    });

    it('should return 404 for non-existent note', async () => {
      mockReq.params.id = 'non-existent';
      NoteRepository.findById.mockResolvedValue(null);

      await NoteController.deleteNote(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
    });
  });

  describe('updateNoteStatus', () => {
    it('should update note status successfully', async () => {
      const existingNote = { id: 'note-1', title: 'Test Note', userId: 'user-123', status: 'todo' };
      const updatedNote = { ...existingNote, status: 'in_progress' };

      mockReq.params.id = 'note-1';
      mockReq.body = { status: 'in_progress' };

      NoteRepository.findById.mockResolvedValue(existingNote);
      NoteRepository.updateStatus.mockResolvedValue(updatedNote);

      await NoteController.updateNoteStatus(mockReq, mockRes, mockNext);

      expect(NoteRepository.findById).toHaveBeenCalledWith('note-1');
      expect(NoteRepository.updateStatus).toHaveBeenCalledWith('note-1', 'in_progress');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Note status updated successfully',
        data: updatedNote
      });
    });

    it('should handle status change to done with archiving', async () => {
      const existingNote = { id: 'note-1', title: 'Test Note', userId: 'user-123', status: 'in_progress' };
      const updatedNote = { ...existingNote, status: 'done', completedAt: new Date().toISOString() };

      mockReq.params.id = 'note-1';
      mockReq.body = { status: 'done' };

      NoteRepository.findById.mockResolvedValue(existingNote);
      NoteRepository.updateStatus.mockResolvedValue(updatedNote);
      HistoryService.archiveNote.mockResolvedValue();

      await NoteController.updateNoteStatus(mockReq, mockRes, mockNext);

      expect(HistoryService.archiveNote).toHaveBeenCalledWith(updatedNote);
    });
  });

  describe('getRecentNotes', () => {
    it('should get recent notes successfully', async () => {
      const mockNotes = [
        { id: 'note-1', title: 'Recent Note 1', userId: 'user-123' },
        { id: 'note-2', title: 'Recent Note 2', userId: 'user-123' }
      ];

      NoteRepository.findRecent.mockResolvedValue(mockNotes);

      await NoteController.getRecentNotes(mockReq, mockRes, mockNext);

      expect(NoteRepository.findRecent).toHaveBeenCalledWith('user-123', 5);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockNotes
      });
    });

    it('should handle limit parameter', async () => {
      mockReq.query.limit = '10';
      const mockNotes = [];

      NoteRepository.findRecent.mockResolvedValue(mockNotes);

      await NoteController.getRecentNotes(mockReq, mockRes, mockNext);

      expect(NoteRepository.findRecent).toHaveBeenCalledWith('user-123', 10);
    });

    it('should limit maximum to 20', async () => {
      mockReq.query.limit = '50';
      const mockNotes = [];

      NoteRepository.findRecent.mockResolvedValue(mockNotes);

      await NoteController.getRecentNotes(mockReq, mockRes, mockNext);

      expect(NoteRepository.findRecent).toHaveBeenCalledWith('user-123', 20);
    });
  });
});