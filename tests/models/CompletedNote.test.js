const CompletedNote = require('../../src/models/CompletedNote');
const Note = require('../../src/models/Note');

describe('CompletedNote Model', () => {
  describe('Constructor', () => {
    it('should create a CompletedNote with default values', () => {
      const completedNote = new CompletedNote();
      
      expect(completedNote.id).toBeNull();
      expect(completedNote.userId).toBeNull();
      expect(completedNote.originalNoteId).toBeNull();
      expect(completedNote.title).toBe('');
      expect(completedNote.description).toBe('');
      expect(completedNote.groupName).toBeNull();
      expect(completedNote.priority).toBe('medium');
      expect(completedNote.completedAt).toBeNull();
      expect(completedNote.createdAt).toBeNull();
    });

    it('should create a CompletedNote with provided data', () => {
      const data = {
        id: 'test-id',
        userId: 'user-123',
        originalNoteId: 'note-456',
        title: 'Test Note',
        description: 'Test description',
        groupName: 'Test Group',
        priority: 'high',
        completedAt: '2024-01-01T10:00:00Z',
        createdAt: '2024-01-01T09:00:00Z'
      };

      const completedNote = new CompletedNote(data);
      
      expect(completedNote.id).toBe('test-id');
      expect(completedNote.userId).toBe('user-123');
      expect(completedNote.originalNoteId).toBe('note-456');
      expect(completedNote.title).toBe('Test Note');
      expect(completedNote.description).toBe('Test description');
      expect(completedNote.groupName).toBe('Test Group');
      expect(completedNote.priority).toBe('high');
      expect(completedNote.completedAt).toBe('2024-01-01T10:00:00Z');
      expect(completedNote.createdAt).toBe('2024-01-01T09:00:00Z');
    });

    it('should handle database format field names', () => {
      const data = {
        user_id: 'user-123',
        original_note_id: 'note-456',
        group_name: 'Test Group',
        completed_at: '2024-01-01T10:00:00Z',
        created_at: '2024-01-01T09:00:00Z'
      };

      const completedNote = new CompletedNote(data);
      
      expect(completedNote.userId).toBe('user-123');
      expect(completedNote.originalNoteId).toBe('note-456');
      expect(completedNote.groupName).toBe('Test Group');
      expect(completedNote.completedAt).toBe('2024-01-01T10:00:00Z');
      expect(completedNote.createdAt).toBe('2024-01-01T09:00:00Z');
    });
  });

  describe('Validation', () => {
    describe('validateCreate', () => {
      it('should validate valid completed note data', () => {
        const data = {
          userId: 'user-123',
          originalNoteId: 'note-456',
          title: 'Test Note',
          description: 'Test description',
          groupName: 'Test Group',
          priority: 'high',
          completedAt: new Date(),
          createdAt: new Date()
        };

        const { error, value } = CompletedNote.validateCreate(data);
        
        expect(error).toBeUndefined();
        expect(value).toMatchObject(data);
      });

      it('should require userId', () => {
        const data = {
          originalNoteId: 'note-456',
          title: 'Test Note',
          priority: 'high',
          completedAt: new Date(),
          createdAt: new Date()
        };

        const { error } = CompletedNote.validateCreate(data);
        
        expect(error).toBeDefined();
        expect(error.details[0].path).toContain('userId');
      });

      it('should require originalNoteId', () => {
        const data = {
          userId: 'user-123',
          title: 'Test Note',
          priority: 'high',
          completedAt: new Date(),
          createdAt: new Date()
        };

        const { error } = CompletedNote.validateCreate(data);
        
        expect(error).toBeDefined();
        expect(error.details[0].path).toContain('originalNoteId');
      });

      it('should require title', () => {
        const data = {
          userId: 'user-123',
          originalNoteId: 'note-456',
          priority: 'high',
          completedAt: new Date(),
          createdAt: new Date()
        };

        const { error } = CompletedNote.validateCreate(data);
        
        expect(error).toBeDefined();
        expect(error.details[0].path).toContain('title');
      });

      it('should validate priority values', () => {
        const data = {
          userId: 'user-123',
          originalNoteId: 'note-456',
          title: 'Test Note',
          priority: 'invalid',
          completedAt: new Date(),
          createdAt: new Date()
        };

        const { error } = CompletedNote.validateCreate(data);
        
        expect(error).toBeDefined();
        expect(error.details[0].path).toContain('priority');
      });

      it('should allow empty description', () => {
        const data = {
          userId: 'user-123',
          originalNoteId: 'note-456',
          title: 'Test Note',
          description: '',
          priority: 'high',
          completedAt: new Date(),
          createdAt: new Date()
        };

        const { error } = CompletedNote.validateCreate(data);
        
        expect(error).toBeUndefined();
      });

      it('should allow null groupName', () => {
        const data = {
          userId: 'user-123',
          originalNoteId: 'note-456',
          title: 'Test Note',
          groupName: null,
          priority: 'high',
          completedAt: new Date(),
          createdAt: new Date()
        };

        const { error } = CompletedNote.validateCreate(data);
        
        expect(error).toBeUndefined();
      });
    });

    describe('validateQuery', () => {
      it('should validate valid query parameters', () => {
        const data = {
          userId: 'user-123',
          startDate: new Date(),
          endDate: new Date(),
          priority: 'high',
          groupName: 'Test Group',
          limit: 20,
          offset: 10
        };

        const { error, value } = CompletedNote.validateQuery(data);
        
        expect(error).toBeUndefined();
        expect(value).toMatchObject(data);
      });

      it('should require userId', () => {
        const data = {
          startDate: new Date(),
          endDate: new Date()
        };

        const { error } = CompletedNote.validateQuery(data);
        
        expect(error).toBeDefined();
        expect(error.details[0].path).toContain('userId');
      });

      it('should apply default values', () => {
        const data = {
          userId: 'user-123'
        };

        const { error, value } = CompletedNote.validateQuery(data);
        
        expect(error).toBeUndefined();
        expect(value.limit).toBe(50);
        expect(value.offset).toBe(0);
      });

      it('should validate limit range', () => {
        const data = {
          userId: 'user-123',
          limit: 150
        };

        const { error } = CompletedNote.validateQuery(data);
        
        expect(error).toBeDefined();
        expect(error.details[0].path).toContain('limit');
      });
    });
  });

  describe('fromNote', () => {
    it('should create CompletedNote from Note instance', () => {
      const noteData = {
        id: 'note-123',
        userId: 'user-456',
        title: 'Test Note',
        description: 'Test description',
        priority: 'high',
        createdAt: '2024-01-01T09:00:00Z',
        completedAt: '2024-01-01T10:00:00Z'
      };

      const note = new Note(noteData);
      const completedNote = CompletedNote.fromNote(note, 'Test Group');
      
      expect(completedNote.userId).toBe('user-456');
      expect(completedNote.originalNoteId).toBe('note-123');
      expect(completedNote.title).toBe('Test Note');
      expect(completedNote.description).toBe('Test description');
      expect(completedNote.groupName).toBe('Test Group');
      expect(completedNote.priority).toBe('high');
      expect(completedNote.createdAt).toBe('2024-01-01T09:00:00Z');
      expect(completedNote.completedAt).toBe('2024-01-01T10:00:00Z');
    });

    it('should use current timestamp if completedAt is not set', () => {
      const noteData = {
        id: 'note-123',
        userId: 'user-456',
        title: 'Test Note',
        priority: 'medium',
        createdAt: '2024-01-01T09:00:00Z'
      };

      const note = new Note(noteData);
      const completedNote = CompletedNote.fromNote(note);
      
      expect(completedNote.completedAt).toBeDefined();
      expect(new Date(completedNote.completedAt)).toBeInstanceOf(Date);
    });
  });

  describe('toDatabase', () => {
    it('should convert to database format', () => {
      const completedNote = new CompletedNote({
        id: 'test-id',
        userId: 'user-123',
        originalNoteId: 'note-456',
        title: 'Test Note',
        description: 'Test description',
        groupName: 'Test Group',
        priority: 'high',
        completedAt: '2024-01-01T10:00:00Z',
        createdAt: '2024-01-01T09:00:00Z'
      });

      const dbFormat = completedNote.toDatabase();
      
      expect(dbFormat).toEqual({
        id: 'test-id',
        user_id: 'user-123',
        original_note_id: 'note-456',
        title: 'Test Note',
        description: 'Test description',
        group_name: 'Test Group',
        priority: 'high',
        completed_at: '2024-01-01T10:00:00Z',
        created_at: '2024-01-01T09:00:00Z'
      });
    });
  });

  describe('toJSON', () => {
    it('should convert to JSON format', () => {
      const completedNote = new CompletedNote({
        id: 'test-id',
        userId: 'user-123',
        originalNoteId: 'note-456',
        title: 'Test Note',
        description: 'Test description',
        groupName: 'Test Group',
        priority: 'high',
        completedAt: '2024-01-01T10:00:00Z',
        createdAt: '2024-01-01T09:00:00Z'
      });

      const jsonFormat = completedNote.toJSON();
      
      expect(jsonFormat).toEqual({
        id: 'test-id',
        userId: 'user-123',
        originalNoteId: 'note-456',
        title: 'Test Note',
        description: 'Test description',
        groupName: 'Test Group',
        priority: 'high',
        completedAt: '2024-01-01T10:00:00Z',
        createdAt: '2024-01-01T09:00:00Z'
      });
    });
  });

  describe('Utility Methods', () => {
    describe('getPriorityColor', () => {
      it('should return correct colors for priorities', () => {
        const highNote = new CompletedNote({ priority: 'high' });
        const mediumNote = new CompletedNote({ priority: 'medium' });
        const lowNote = new CompletedNote({ priority: 'low' });
        
        expect(highNote.getPriorityColor()).toBe('#e74c3c');
        expect(mediumNote.getPriorityColor()).toBe('#f39c12');
        expect(lowNote.getPriorityColor()).toBe('#27ae60');
      });

      it('should return default color for invalid priority', () => {
        const note = new CompletedNote({ priority: 'invalid' });
        expect(note.getPriorityColor()).toBe('#f39c12');
      });
    });

    describe('getFormattedCompletedDate', () => {
      it('should format completion date', () => {
        const completedNote = new CompletedNote({
          completedAt: '2024-01-01T10:30:00Z'
        });
        
        const formatted = completedNote.getFormattedCompletedDate();
        expect(formatted).toMatch(/Jan 1, 2024/);
      });

      it('should return null for no completion date', () => {
        const completedNote = new CompletedNote();
        expect(completedNote.getFormattedCompletedDate()).toBeNull();
      });
    });

    describe('isCompletedToday', () => {
      it('should return true for today completion', () => {
        const today = new Date();
        const completedNote = new CompletedNote({
          completedAt: today.toISOString()
        });
        
        expect(completedNote.isCompletedToday()).toBe(true);
      });

      it('should return false for yesterday completion', () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const completedNote = new CompletedNote({
          completedAt: yesterday.toISOString()
        });
        
        expect(completedNote.isCompletedToday()).toBe(false);
      });

      it('should return false for no completion date', () => {
        const completedNote = new CompletedNote();
        expect(completedNote.isCompletedToday()).toBe(false);
      });
    });

    describe('isCompletedInRange', () => {
      it('should return true for date in range', () => {
        const completedNote = new CompletedNote({
          completedAt: '2024-01-15T10:00:00Z'
        });
        
        const result = completedNote.isCompletedInRange(
          '2024-01-01T00:00:00Z',
          '2024-01-31T23:59:59Z'
        );
        
        expect(result).toBe(true);
      });

      it('should return false for date outside range', () => {
        const completedNote = new CompletedNote({
          completedAt: '2024-02-15T10:00:00Z'
        });
        
        const result = completedNote.isCompletedInRange(
          '2024-01-01T00:00:00Z',
          '2024-01-31T23:59:59Z'
        );
        
        expect(result).toBe(false);
      });

      it('should return false for no completion date', () => {
        const completedNote = new CompletedNote();
        
        const result = completedNote.isCompletedInRange(
          '2024-01-01T00:00:00Z',
          '2024-01-31T23:59:59Z'
        );
        
        expect(result).toBe(false);
      });
    });
  });
});