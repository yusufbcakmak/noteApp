const Note = require('../../src/models/Note');

describe('Note Model', () => {
  describe('Constructor', () => {
    test('should create note with default values', () => {
      const note = new Note();
      
      expect(note.id).toBeNull();
      expect(note.userId).toBeNull();
      expect(note.groupId).toBeNull();
      expect(note.title).toBeNull();
      expect(note.description).toBeNull();
      expect(note.status).toBe('todo');
      expect(note.priority).toBe('medium');
      expect(note.createdAt).toBeNull();
      expect(note.updatedAt).toBeNull();
      expect(note.completedAt).toBeNull();
    });

    test('should create note with provided data', () => {
      const noteData = {
        id: 'note123',
        userId: 'user123',
        groupId: 'group123',
        title: 'Test Note',
        description: 'Test Description',
        status: 'in_progress',
        priority: 'high',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        completedAt: null
      };

      const note = new Note(noteData);
      
      expect(note.id).toBe('note123');
      expect(note.userId).toBe('user123');
      expect(note.groupId).toBe('group123');
      expect(note.title).toBe('Test Note');
      expect(note.description).toBe('Test Description');
      expect(note.status).toBe('in_progress');
      expect(note.priority).toBe('high');
      expect(note.createdAt).toBe('2024-01-01T00:00:00Z');
      expect(note.updatedAt).toBe('2024-01-01T00:00:00Z');
      expect(note.completedAt).toBeNull();
    });

    test('should handle database format field names', () => {
      const dbData = {
        id: 'note123',
        user_id: 'user123',
        group_id: 'group123',
        title: 'Test Note',
        description: 'Test Description',
        status: 'done',
        priority: 'low',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        completed_at: '2024-01-01T01:00:00Z'
      };

      const note = new Note(dbData);
      
      expect(note.userId).toBe('user123');
      expect(note.groupId).toBe('group123');
      expect(note.createdAt).toBe('2024-01-01T00:00:00Z');
      expect(note.updatedAt).toBe('2024-01-01T00:00:00Z');
      expect(note.completedAt).toBe('2024-01-01T01:00:00Z');
    });
  });

  describe('Static Properties', () => {
    test('should have correct STATUSES', () => {
      expect(Note.STATUSES).toEqual(['todo', 'in_progress', 'done']);
    });

    test('should have correct PRIORITIES', () => {
      expect(Note.PRIORITIES).toEqual(['low', 'medium', 'high']);
    });

    test('should have correct PRIORITY_COLORS', () => {
      expect(Note.PRIORITY_COLORS).toEqual({
        low: '#28a745',
        medium: '#ffc107',
        high: '#dc3545'
      });
    });
  });

  describe('Validation Schemas', () => {
    describe('createSchema', () => {
      test('should validate valid note creation data', () => {
        const validData = {
          userId: 'user-123',
          title: 'Test Note',
          description: 'Test Description',
          priority: 'high',
          status: 'todo'
        };

        const { error, value } = Note.validate(validData, Note.createSchema);
        
        expect(error).toBeUndefined();
        expect(value.title).toBe('Test Note');
        expect(value.description).toBe('Test Description');
        expect(value.priority).toBe('high');
        expect(value.status).toBe('todo');
      });

      test('should require title', () => {
        const invalidData = {
          userId: 'user-123',
          description: 'Test Description'
        };

        const { error } = Note.validate(invalidData, Note.createSchema);
        
        expect(error).toBeDefined();
        expect(error.details[0].path).toEqual(['title']);
        expect(error.details[0].message).toBe('Title is required');
      });

      test('should reject empty title', () => {
        const invalidData = {
          userId: 'user-123',
          title: ''
        };

        const { error } = Note.validate(invalidData, Note.createSchema);
        
        expect(error).toBeDefined();
        expect(error.details[0].message).toBe('Title cannot be empty');
      });

      test('should reject title longer than 255 characters', () => {
        const invalidData = {
          userId: 'user-123',
          title: 'a'.repeat(256)
        };

        const { error } = Note.validate(invalidData, Note.createSchema);
        
        expect(error).toBeDefined();
        expect(error.details[0].message).toBe('Title cannot exceed 255 characters');
      });

      test('should reject description longer than 2000 characters', () => {
        const invalidData = {
          userId: 'user-123',
          title: 'Test Note',
          description: 'a'.repeat(2001)
        };

        const { error } = Note.validate(invalidData, Note.createSchema);
        
        expect(error).toBeDefined();
        expect(error.details[0].message).toBe('Description cannot exceed 2000 characters');
      });

      test('should reject invalid priority', () => {
        const invalidData = {
          userId: 'user-123',
          title: 'Test Note',
          priority: 'invalid'
        };

        const { error } = Note.validate(invalidData, Note.createSchema);
        
        expect(error).toBeDefined();
        expect(error.details[0].message).toBe('Priority must be one of: low, medium, high');
      });

      test('should reject invalid status', () => {
        const invalidData = {
          userId: 'user-123',
          title: 'Test Note',
          status: 'invalid'
        };

        const { error } = Note.validate(invalidData, Note.createSchema);
        
        expect(error).toBeDefined();
        expect(error.details[0].message).toBe('Status must be one of: todo, in_progress, done');
      });

      test('should allow empty description', () => {
        const validData = {
          userId: 'user-123',
          title: 'Test Note',
          description: ''
        };

        const { error } = Note.validate(validData, Note.createSchema);
        
        expect(error).toBeUndefined();
      });

      test('should allow null groupId', () => {
        const validData = {
          userId: 'user-123',
          title: 'Test Note',
          groupId: null
        };

        const { error } = Note.validate(validData, Note.createSchema);
        
        expect(error).toBeUndefined();
      });
    });

    describe('updateSchema', () => {
      test('should validate valid update data', () => {
        const validData = {
          title: 'Updated Note',
          priority: 'low'
        };

        const { error } = Note.validate(validData, Note.updateSchema);
        
        expect(error).toBeUndefined();
      });

      test('should allow partial updates', () => {
        const validData = {
          priority: 'high'
        };

        const { error } = Note.validate(validData, Note.updateSchema);
        
        expect(error).toBeUndefined();
      });

      test('should reject empty title in update', () => {
        const invalidData = {
          title: ''
        };

        const { error } = Note.validate(invalidData, Note.updateSchema);
        
        expect(error).toBeDefined();
        expect(error.details[0].message).toBe('Title cannot be empty');
      });
    });

    describe('statusUpdateSchema', () => {
      test('should validate valid status update', () => {
        const validData = {
          status: 'done'
        };

        const { error } = Note.validate(validData, Note.statusUpdateSchema);
        
        expect(error).toBeUndefined();
      });

      test('should require status', () => {
        const invalidData = {};

        const { error } = Note.validate(invalidData, Note.statusUpdateSchema);
        
        expect(error).toBeDefined();
        expect(error.details[0].message).toBe('Status is required');
      });

      test('should reject invalid status', () => {
        const invalidData = {
          status: 'invalid'
        };

        const { error } = Note.validate(invalidData, Note.statusUpdateSchema);
        
        expect(error).toBeDefined();
        expect(error.details[0].message).toBe('Status must be one of: todo, in_progress, done');
      });
    });
  });

  describe('Static Methods', () => {
    describe('isValidStatusTransition', () => {
      test('should allow all valid status transitions', () => {
        expect(Note.isValidStatusTransition('todo', 'in_progress')).toBe(true);
        expect(Note.isValidStatusTransition('in_progress', 'done')).toBe(true);
        expect(Note.isValidStatusTransition('done', 'todo')).toBe(true);
        expect(Note.isValidStatusTransition('todo', 'done')).toBe(true);
      });

      test('should reject invalid statuses', () => {
        expect(Note.isValidStatusTransition('invalid', 'todo')).toBe(false);
        expect(Note.isValidStatusTransition('todo', 'invalid')).toBe(false);
      });
    });

    describe('getPriorityColor', () => {
      test('should return correct colors for priorities', () => {
        expect(Note.getPriorityColor('low')).toBe('#28a745');
        expect(Note.getPriorityColor('medium')).toBe('#ffc107');
        expect(Note.getPriorityColor('high')).toBe('#dc3545');
      });

      test('should return medium color for invalid priority', () => {
        expect(Note.getPriorityColor('invalid')).toBe('#ffc107');
      });
    });

    describe('fromDatabaseRow', () => {
      test('should create Note from database row', () => {
        const row = {
          id: 'note123',
          user_id: 'user123',
          title: 'Test Note',
          status: 'todo',
          priority: 'medium'
        };

        const note = Note.fromDatabaseRow(row);
        
        expect(note).toBeInstanceOf(Note);
        expect(note.id).toBe('note123');
        expect(note.userId).toBe('user123');
        expect(note.title).toBe('Test Note');
      });

      test('should return null for null row', () => {
        const note = Note.fromDatabaseRow(null);
        expect(note).toBeNull();
      });
    });
  });

  describe('Instance Methods', () => {
    let note;

    beforeEach(() => {
      note = new Note({
        id: 'note123',
        userId: 'user123',
        title: 'Test Note',
        description: 'Test Description',
        status: 'todo',
        priority: 'medium',
        createdAt: '2024-01-01T00:00:00Z'
      });
    });

    describe('Status Check Methods', () => {
      test('should check if note is completed', () => {
        expect(note.isCompleted()).toBe(false);
        
        note.status = 'done';
        expect(note.isCompleted()).toBe(true);
      });

      test('should check if note is in progress', () => {
        expect(note.isInProgress()).toBe(false);
        
        note.status = 'in_progress';
        expect(note.isInProgress()).toBe(true);
      });

      test('should check if note is todo', () => {
        expect(note.isTodo()).toBe(true);
        
        note.status = 'done';
        expect(note.isTodo()).toBe(false);
      });
    });

    describe('Priority Check Methods', () => {
      test('should check if note has high priority', () => {
        expect(note.isHighPriority()).toBe(false);
        
        note.priority = 'high';
        expect(note.isHighPriority()).toBe(true);
      });

      test('should check if note has medium priority', () => {
        expect(note.isMediumPriority()).toBe(true);
        
        note.priority = 'low';
        expect(note.isMediumPriority()).toBe(false);
      });

      test('should check if note has low priority', () => {
        expect(note.isLowPriority()).toBe(false);
        
        note.priority = 'low';
        expect(note.isLowPriority()).toBe(true);
      });
    });

    describe('updateStatus', () => {
      test('should update status and set completion timestamp', () => {
        const originalUpdatedAt = note.updatedAt;
        
        note.updateStatus('done');
        
        expect(note.status).toBe('done');
        expect(note.completedAt).toBeTruthy();
        expect(note.updatedAt).not.toBe(originalUpdatedAt);
      });

      test('should clear completion timestamp when moving away from done', () => {
        note.status = 'done';
        note.completedAt = '2024-01-01T01:00:00Z';
        
        note.updateStatus('todo');
        
        expect(note.status).toBe('todo');
        expect(note.completedAt).toBeNull();
      });

      test('should throw error for invalid status', () => {
        expect(() => {
          note.updateStatus('invalid');
        }).toThrow('Invalid status: invalid');
      });
    });

    describe('updatePriority', () => {
      test('should update priority', () => {
        const originalUpdatedAt = note.updatedAt;
        
        note.updatePriority('high');
        
        expect(note.priority).toBe('high');
        expect(note.updatedAt).not.toBe(originalUpdatedAt);
      });

      test('should throw error for invalid priority', () => {
        expect(() => {
          note.updatePriority('invalid');
        }).toThrow('Invalid priority: invalid');
      });
    });

    describe('toJSON', () => {
      test('should convert to JSON with priority color', () => {
        const json = note.toJSON();
        
        expect(json).toEqual({
          id: 'note123',
          userId: 'user123',
          groupId: null,
          title: 'Test Note',
          description: 'Test Description',
          status: 'todo',
          priority: 'medium',
          priorityColor: '#ffc107',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: null,
          completedAt: null
        });
      });
    });

    describe('toDatabaseFormat', () => {
      test('should convert to database format', () => {
        const dbFormat = note.toDatabaseFormat();
        
        expect(dbFormat).toEqual({
          id: 'note123',
          user_id: 'user123',
          group_id: null,
          title: 'Test Note',
          description: 'Test Description',
          status: 'todo',
          priority: 'medium',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: null,
          completed_at: null
        });
      });
    });

    describe('Date Formatting Methods', () => {
      test('should format creation date', () => {
        const formatted = note.getFormattedCreatedAt();
        expect(formatted).toBe('1/1/2024');
      });

      test('should return empty string for null creation date', () => {
        note.createdAt = null;
        const formatted = note.getFormattedCreatedAt();
        expect(formatted).toBe('');
      });

      test('should format completion date', () => {
        note.completedAt = '2024-01-02T00:00:00Z';
        const formatted = note.getFormattedCompletedAt();
        expect(formatted).toBe('1/2/2024');
      });

      test('should return empty string for null completion date', () => {
        const formatted = note.getFormattedCompletedAt();
        expect(formatted).toBe('');
      });
    });

    describe('getTimeSinceCreation', () => {
      test('should return empty string for null creation date', () => {
        note.createdAt = null;
        const timeSince = note.getTimeSinceCreation();
        expect(timeSince).toBe('');
      });

      test('should return "Today" for today\'s date', () => {
        note.createdAt = new Date().toISOString();
        const timeSince = note.getTimeSinceCreation();
        expect(timeSince).toBe('Today');
      });

      test('should return "Yesterday" for yesterday\'s date', () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        note.createdAt = yesterday.toISOString();
        const timeSince = note.getTimeSinceCreation();
        expect(timeSince).toBe('Yesterday');
      });

      test('should return days ago for recent dates', () => {
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        note.createdAt = threeDaysAgo.toISOString();
        const timeSince = note.getTimeSinceCreation();
        expect(timeSince).toBe('3 days ago');
      });
    });
  });
});