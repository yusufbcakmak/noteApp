const Group = require('../../src/models/Group');

describe('Group Model', () => {
  describe('Constructor', () => {
    it('should create a group with default values', () => {
      const group = new Group();
      
      expect(group.id).toBeNull();
      expect(group.userId).toBeNull();
      expect(group.name).toBeNull();
      expect(group.description).toBeNull();
      expect(group.color).toBe('#3498db');
      expect(group.createdAt).toBeNull();
      expect(group.updatedAt).toBeNull();
    });

    it('should create a group with provided data', () => {
      const groupData = {
        id: 'test-id',
        userId: 'user-id',
        name: 'Test Group',
        description: 'Test description',
        color: '#e74c3c',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      const group = new Group(groupData);
      
      expect(group.id).toBe('test-id');
      expect(group.userId).toBe('user-id');
      expect(group.name).toBe('Test Group');
      expect(group.description).toBe('Test description');
      expect(group.color).toBe('#e74c3c');
      expect(group.createdAt).toBe('2024-01-01T00:00:00Z');
      expect(group.updatedAt).toBe('2024-01-01T00:00:00Z');
    });

    it('should handle database format field names', () => {
      const groupData = {
        id: 'test-id',
        user_id: 'user-id',
        name: 'Test Group',
        description: 'Test description',
        color: '#e74c3c',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      const group = new Group(groupData);
      
      expect(group.userId).toBe('user-id');
      expect(group.createdAt).toBe('2024-01-01T00:00:00Z');
      expect(group.updatedAt).toBe('2024-01-01T00:00:00Z');
    });
  });

  describe('Validation Schemas', () => {
    describe('creationSchema', () => {
      it('should validate valid creation data', () => {
        const validData = {
          userId: 'user-123',
          name: 'Test Group',
          description: 'Test description',
          color: '#3498db'
        };

        const { error } = Group.creationSchema.validate(validData);
        expect(error).toBeUndefined();
      });

      it('should validate minimal valid data', () => {
        const validData = {
          userId: 'user-123',
          name: 'Test Group'
        };

        const { error } = Group.creationSchema.validate(validData);
        expect(error).toBeUndefined();
      });

      it('should reject empty name', () => {
        const invalidData = {
          userId: 'user-123',
          name: ''
        };

        const { error } = Group.creationSchema.validate(invalidData);
        expect(error).toBeDefined();
        expect(error.details[0].message).toContain('at least 1 character');
      });

      it('should reject missing name', () => {
        const invalidData = {
          userId: 'user-123',
          description: 'Test description'
        };

        const { error } = Group.creationSchema.validate(invalidData);
        expect(error).toBeDefined();
        expect(error.details[0].message).toContain('Group name is required');
      });

      it('should reject name that is too long', () => {
        const invalidData = {
          userId: 'user-123',
          name: 'a'.repeat(101)
        };

        const { error } = Group.creationSchema.validate(invalidData);
        expect(error).toBeDefined();
        expect(error.details[0].message).toContain('cannot exceed 100 characters');
      });

      it('should reject description that is too long', () => {
        const invalidData = {
          userId: 'user-123',
          name: 'Test Group',
          description: 'a'.repeat(501)
        };

        const { error } = Group.creationSchema.validate(invalidData);
        expect(error).toBeDefined();
        expect(error.details[0].message).toContain('cannot exceed 500 characters');
      });

      it('should reject invalid color format', () => {
        const invalidData = {
          userId: 'user-123',
          name: 'Test Group',
          color: 'invalid-color'
        };

        const { error } = Group.creationSchema.validate(invalidData);
        expect(error).toBeDefined();
        expect(error.details[0].message).toContain('valid hex color code');
      });

      it('should accept valid hex colors', () => {
        const validColors = ['#000000', '#FFFFFF', '#3498db', '#E74C3C'];
        
        validColors.forEach(color => {
          const validData = {
            userId: 'user-123',
            name: 'Test Group',
            color: color
          };

          const { error } = Group.creationSchema.validate(validData);
          expect(error).toBeUndefined();
        });
      });

      it('should allow empty description', () => {
        const validData = {
          userId: 'user-123',
          name: 'Test Group',
          description: ''
        };

        const { error } = Group.creationSchema.validate(validData);
        expect(error).toBeUndefined();
      });
    });

    describe('updateSchema', () => {
      it('should validate valid update data', () => {
        const validData = {
          name: 'Updated Group',
          description: 'Updated description',
          color: '#2ecc71'
        };

        const { error } = Group.updateSchema.validate(validData);
        expect(error).toBeUndefined();
      });

      it('should allow partial updates', () => {
        const validData = {
          name: 'Updated Group'
        };

        const { error } = Group.updateSchema.validate(validData);
        expect(error).toBeUndefined();
      });

      it('should allow empty object for update', () => {
        const validData = {};

        const { error } = Group.updateSchema.validate(validData);
        expect(error).toBeUndefined();
      });

      it('should reject invalid name in update', () => {
        const invalidData = {
          name: ''
        };

        const { error } = Group.updateSchema.validate(invalidData);
        expect(error).toBeDefined();
        expect(error.details[0].message).toContain('at least 1 character');
      });
    });
  });

  describe('Instance Methods', () => {
    let group;

    beforeEach(() => {
      group = new Group({
        id: 'test-id',
        userId: 'user-id',
        name: 'Test Group',
        description: 'Test description',
        color: '#3498db',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      });
    });

    describe('toJSON', () => {
      it('should return group data as plain object', () => {
        const json = group.toJSON();
        
        expect(json.id).toBe('test-id');
        expect(json.userId).toBe('user-id');
        expect(json.name).toBe('Test Group');
        expect(json.description).toBe('Test description');
        expect(json.color).toBe('#3498db');
        expect(json.createdAt).toBe('2024-01-01T00:00:00Z');
        expect(json.updatedAt).toBe('2024-01-01T00:00:00Z');
      });
    });

    describe('toDatabaseFormat', () => {
      it('should convert to database format', () => {
        const dbFormat = group.toDatabaseFormat();
        
        expect(dbFormat.user_id).toBe('user-id');
        expect(dbFormat.created_at).toBe('2024-01-01T00:00:00Z');
        expect(dbFormat.updated_at).toBe('2024-01-01T00:00:00Z');
        expect(dbFormat.name).toBe('Test Group');
        expect(dbFormat.description).toBe('Test description');
        expect(dbFormat.color).toBe('#3498db');
      });
    });

    describe('belongsToUser', () => {
      it('should return true for correct user', () => {
        expect(group.belongsToUser('user-id')).toBe(true);
      });

      it('should return false for different user', () => {
        expect(group.belongsToUser('different-user-id')).toBe(false);
      });
    });

    describe('update', () => {
      it('should update group properties', () => {
        const updates = {
          name: 'Updated Group',
          description: 'Updated description',
          color: '#e74c3c'
        };

        const originalUpdatedAt = group.updatedAt;
        group.update(updates);

        expect(group.name).toBe('Updated Group');
        expect(group.description).toBe('Updated description');
        expect(group.color).toBe('#e74c3c');
        expect(group.updatedAt).not.toBe(originalUpdatedAt);
      });

      it('should update only provided properties', () => {
        const originalName = group.name;
        const originalColor = group.color;
        
        const updates = {
          description: 'New description'
        };

        group.update(updates);

        expect(group.name).toBe(originalName);
        expect(group.color).toBe(originalColor);
        expect(group.description).toBe('New description');
      });

      it('should handle undefined values', () => {
        const originalName = group.name;
        
        const updates = {
          name: undefined,
          description: 'New description'
        };

        group.update(updates);

        expect(group.name).toBe(originalName);
        expect(group.description).toBe('New description');
      });
    });
  });

  describe('Static Methods', () => {
    describe('fromDatabaseRow', () => {
      it('should create group from database row', () => {
        const row = {
          id: 'test-id',
          user_id: 'user-id',
          name: 'Test Group',
          description: 'Test description',
          color: '#3498db',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        };

        const group = Group.fromDatabaseRow(row);
        
        expect(group).toBeInstanceOf(Group);
        expect(group.userId).toBe('user-id');
        expect(group.name).toBe('Test Group');
        expect(group.createdAt).toBe('2024-01-01T00:00:00Z');
      });

      it('should return null for null row', () => {
        const group = Group.fromDatabaseRow(null);
        expect(group).toBeNull();
      });
    });

    describe('validate', () => {
      it('should validate data against schema', () => {
        const data = {
          userId: 'user-123',
          name: 'Test Group',
          description: 'Test description',
          color: '#3498db'
        };

        const result = Group.validate(data, Group.creationSchema);
        expect(result.error).toBeUndefined();
        expect(result.value).toEqual(data);
      });

      it('should return validation errors', () => {
        const data = {
          name: '',
          color: 'invalid-color'
        };

        const result = Group.validate(data, Group.creationSchema);
        expect(result.error).toBeDefined();
        expect(result.error.details.length).toBeGreaterThan(0);
      });
    });

    describe('getDefaultColors', () => {
      it('should return array of default colors', () => {
        const colors = Group.getDefaultColors();
        
        expect(Array.isArray(colors)).toBe(true);
        expect(colors.length).toBeGreaterThan(0);
        expect(colors).toContain('#3498db');
        expect(colors).toContain('#e74c3c');
        expect(colors).toContain('#2ecc71');
      });

      it('should return valid hex colors', () => {
        const colors = Group.getDefaultColors();
        
        colors.forEach(color => {
          expect(Group.isValidColor(color)).toBe(true);
        });
      });
    });

    describe('isValidColor', () => {
      it('should return true for valid hex colors', () => {
        const validColors = ['#000000', '#FFFFFF', '#3498db', '#E74C3C'];
        
        validColors.forEach(color => {
          expect(Group.isValidColor(color)).toBe(true);
        });
      });

      it('should return false for invalid colors', () => {
        const invalidColors = ['000000', '#GGG', 'blue', '#12345', '#1234567'];
        
        invalidColors.forEach(color => {
          expect(Group.isValidColor(color)).toBe(false);
        });
      });
    });
  });
});