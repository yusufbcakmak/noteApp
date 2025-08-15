const {
  authSchemas,
  noteSchemas,
  groupSchemas,
  userSchemas,
  historySchemas,
  paramSchemas
} = require('../../src/validation/schemas');

describe('Validation Schemas', () => {
  describe('authSchemas', () => {
    describe('register', () => {
      it('should validate valid registration data', () => {
        const data = {
          email: 'test@example.com',
          password: 'Password123',
          firstName: 'John',
          lastName: 'Doe'
        };

        const { error, value } = authSchemas.register.validate(data);
        expect(error).toBeUndefined();
        expect(value.email).toBe('test@example.com');
      });

      it('should fail with invalid email', () => {
        const data = {
          email: 'invalid-email',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe'
        };

        const { error } = authSchemas.register.validate(data);
        expect(error).toBeDefined();
        expect(error.details[0].path).toContain('email');
      });

      it('should fail with short password', () => {
        const data = {
          email: 'test@example.com',
          password: '123',
          firstName: 'John',
          lastName: 'Doe'
        };

        const { error } = authSchemas.register.validate(data);
        expect(error).toBeDefined();
        expect(error.details[0].path).toContain('password');
      });

      it('should fail with missing required fields', () => {
        const data = {
          email: 'test@example.com'
        };

        const { error } = authSchemas.register.validate(data);
        expect(error).toBeDefined();
        expect(error.details.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('login', () => {
      it('should validate valid login data', () => {
        const data = {
          email: 'test@example.com',
          password: 'Password123'
        };

        const { error, value } = authSchemas.login.validate(data);
        expect(error).toBeUndefined();
        expect(value.email).toBe('test@example.com');
      });

      it('should fail with missing password', () => {
        const data = {
          email: 'test@example.com'
        };

        const { error } = authSchemas.login.validate(data);
        expect(error).toBeDefined();
        expect(error.details[0].path).toContain('password');
      });
    });

    describe('changePassword', () => {
      it('should validate valid password change data', () => {
        const data = {
          currentPassword: 'oldpassword',
          newPassword: 'newpassword123'
        };

        const { error } = authSchemas.changePassword.validate(data);
        expect(error).toBeUndefined();
      });

      it('should fail with short new password', () => {
        const data = {
          currentPassword: 'oldpassword',
          newPassword: '123'
        };

        const { error } = authSchemas.changePassword.validate(data);
        expect(error).toBeDefined();
        expect(error.details[0].path).toContain('newPassword');
      });
    });
  });

  describe('noteSchemas', () => {
    describe('create', () => {
      it('should validate valid note creation data', () => {
        const data = {
          title: 'Test Note',
          description: 'Test description',
          priority: 'high'
        };

        const { error, value } = noteSchemas.create.validate(data);
        expect(error).toBeUndefined();
        expect(value.title).toBe('Test Note');
        expect(value.priority).toBe('high');
      });

      it('should set default priority', () => {
        const data = {
          title: 'Test Note'
        };

        const { error, value } = noteSchemas.create.validate(data);
        expect(error).toBeUndefined();
        expect(value.priority).toBe('medium');
      });

      it('should fail with empty title', () => {
        const data = {
          title: ''
        };

        const { error } = noteSchemas.create.validate(data);
        expect(error).toBeDefined();
        expect(error.details[0].path).toContain('title');
      });

      it('should fail with invalid priority', () => {
        const data = {
          title: 'Test Note',
          priority: 'invalid'
        };

        const { error } = noteSchemas.create.validate(data);
        expect(error).toBeDefined();
        expect(error.details[0].path).toContain('priority');
      });

      it('should validate valid groupId', () => {
        const data = {
          title: 'Test Note',
          groupId: 'a1b2c3d4e5f6789012345678901234ab'
        };

        const { error } = noteSchemas.create.validate(data);
        expect(error).toBeUndefined();
      });

      it('should allow null groupId', () => {
        const data = {
          title: 'Test Note',
          groupId: null
        };

        const { error } = noteSchemas.create.validate(data);
        expect(error).toBeUndefined();
      });
    });

    describe('update', () => {
      it('should validate partial update data', () => {
        const data = {
          title: 'Updated Title'
        };

        const { error } = noteSchemas.update.validate(data);
        expect(error).toBeUndefined();
      });

      it('should fail with empty update data', () => {
        const data = {};

        const { error } = noteSchemas.update.validate(data);
        expect(error).toBeDefined();
      });

      it('should validate status update', () => {
        const data = {
          status: 'in_progress'
        };

        const { error } = noteSchemas.update.validate(data);
        expect(error).toBeUndefined();
      });

      it('should fail with invalid status', () => {
        const data = {
          status: 'invalid_status'
        };

        const { error } = noteSchemas.update.validate(data);
        expect(error).toBeDefined();
        expect(error.details[0].path).toContain('status');
      });
    });

    describe('statusUpdate', () => {
      it('should validate status update', () => {
        const data = {
          status: 'done'
        };

        const { error } = noteSchemas.statusUpdate.validate(data);
        expect(error).toBeUndefined();
      });

      it('should fail without status', () => {
        const data = {};

        const { error } = noteSchemas.statusUpdate.validate(data);
        expect(error).toBeDefined();
        expect(error.details[0].path).toContain('status');
      });
    });

    describe('query', () => {
      it('should validate query parameters with defaults', () => {
        const data = {};

        const { error, value } = noteSchemas.query.validate(data);
        expect(error).toBeUndefined();
        expect(value.page).toBe(1);
        expect(value.limit).toBe(10);
        expect(value.sortBy).toBe('created_at');
        expect(value.sortOrder).toBe('DESC');
      });

      it('should validate custom query parameters', () => {
        const data = {
          page: 2,
          limit: 20,
          status: 'todo',
          priority: 'high',
          search: 'test',
          sortBy: 'title',
          sortOrder: 'ASC'
        };

        const { error, value } = noteSchemas.query.validate(data);
        expect(error).toBeUndefined();
        expect(value.page).toBe(2);
        expect(value.limit).toBe(20);
        expect(value.status).toBe('todo');
        expect(value.priority).toBe('high');
        expect(value.search).toBe('test');
        expect(value.sortBy).toBe('title');
        expect(value.sortOrder).toBe('ASC');
      });

      it('should enforce limit maximum', () => {
        const data = {
          limit: 200
        };

        const { error } = noteSchemas.query.validate(data);
        expect(error).toBeDefined();
        expect(error.details[0].path).toContain('limit');
      });

      it('should enforce page minimum', () => {
        const data = {
          page: 0
        };

        const { error } = noteSchemas.query.validate(data);
        expect(error).toBeDefined();
        expect(error.details[0].path).toContain('page');
      });
    });
  });

  describe('groupSchemas', () => {
    describe('create', () => {
      it('should validate valid group creation data', () => {
        const data = {
          name: 'Test Group',
          description: 'Test description',
          color: '#ff0000'
        };

        const { error, value } = groupSchemas.create.validate(data);
        expect(error).toBeUndefined();
        expect(value.name).toBe('Test Group');
        expect(value.color).toBe('#ff0000');
      });

      it('should set default color', () => {
        const data = {
          name: 'Test Group'
        };

        const { error, value } = groupSchemas.create.validate(data);
        expect(error).toBeUndefined();
        expect(value.color).toBe('#3498db');
      });

      it('should fail with empty name', () => {
        const data = {
          name: ''
        };

        const { error } = groupSchemas.create.validate(data);
        expect(error).toBeDefined();
        expect(error.details[0].path).toContain('name');
      });

      it('should fail with invalid color format', () => {
        const data = {
          name: 'Test Group',
          color: 'invalid-color'
        };

        const { error } = groupSchemas.create.validate(data);
        expect(error).toBeDefined();
        expect(error.details[0].path).toContain('color');
      });
    });

    describe('update', () => {
      it('should validate partial update data', () => {
        const data = {
          name: 'Updated Group'
        };

        const { error } = groupSchemas.update.validate(data);
        expect(error).toBeUndefined();
      });

      it('should fail with empty update data', () => {
        const data = {};

        const { error } = groupSchemas.update.validate(data);
        expect(error).toBeDefined();
      });
    });
  });

  describe('userSchemas', () => {
    describe('updateProfile', () => {
      it('should validate profile update data', () => {
        const data = {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        };

        const { error } = userSchemas.updateProfile.validate(data);
        expect(error).toBeUndefined();
      });

      it('should validate password change', () => {
        const data = {
          currentPassword: 'oldpassword',
          newPassword: 'newpassword123'
        };

        const { error } = userSchemas.updateProfile.validate(data);
        expect(error).toBeUndefined();
      });

      it('should require currentPassword when newPassword is provided', () => {
        const data = {
          newPassword: 'newpassword123'
        };

        const { error } = userSchemas.updateProfile.validate(data);
        expect(error).toBeDefined();
        expect(error.details[0].path).toContain('currentPassword');
      });

      it('should fail with empty update data', () => {
        const data = {};

        const { error } = userSchemas.updateProfile.validate(data);
        expect(error).toBeDefined();
      });
    });

    describe('deleteAccount', () => {
      it('should validate account deletion data', () => {
        const data = {
          password: 'password123',
          confirmation: 'DELETE_MY_ACCOUNT'
        };

        const { error } = userSchemas.deleteAccount.validate(data);
        expect(error).toBeUndefined();
      });

      it('should fail with wrong confirmation', () => {
        const data = {
          password: 'password123',
          confirmation: 'wrong confirmation'
        };

        const { error } = userSchemas.deleteAccount.validate(data);
        expect(error).toBeDefined();
        expect(error.details[0].path).toContain('confirmation');
      });
    });
  });

  describe('historySchemas', () => {
    describe('query', () => {
      it('should validate history query with defaults', () => {
        const data = {};

        const { error, value } = historySchemas.query.validate(data);
        expect(error).toBeUndefined();
        expect(value.page).toBe(1);
        expect(value.limit).toBe(10);
        expect(value.sortBy).toBe('completed_at');
        expect(value.sortOrder).toBe('DESC');
      });

      it('should validate date range', () => {
        const data = {
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: '2024-01-31T23:59:59.999Z'
        };

        const { error } = historySchemas.query.validate(data);
        expect(error).toBeUndefined();
      });

      it('should fail when endDate is before startDate', () => {
        const data = {
          startDate: '2024-01-31T00:00:00.000Z',
          endDate: '2024-01-01T00:00:00.000Z'
        };

        const { error } = historySchemas.query.validate(data);
        expect(error).toBeDefined();
        expect(error.details[0].path).toContain('endDate');
      });
    });

    describe('dailyQuery', () => {
      it('should validate daily query with defaults', () => {
        const data = {};

        const { error, value } = historySchemas.dailyQuery.validate(data);
        expect(error).toBeUndefined();
        expect(value.days).toBe(30);
      });

      it('should validate custom date and days', () => {
        const data = {
          date: '2024-01-01T00:00:00.000Z',
          days: 7
        };

        const { error, value } = historySchemas.dailyQuery.validate(data);
        expect(error).toBeUndefined();
        expect(value.days).toBe(7);
      });

      it('should enforce days maximum', () => {
        const data = {
          days: 500
        };

        const { error } = historySchemas.dailyQuery.validate(data);
        expect(error).toBeDefined();
        expect(error.details[0].path).toContain('days');
      });
    });
  });

  describe('paramSchemas', () => {
    describe('id', () => {
      it('should validate valid hex ID', () => {
        const data = {
          id: 'a1b2c3d4e5f6789012345678901234ab'
        };

        const { error } = paramSchemas.id.validate(data);
        expect(error).toBeUndefined();
      });

      it('should fail with invalid ID format', () => {
        const data = {
          id: 'invalid-id'
        };

        const { error } = paramSchemas.id.validate(data);
        expect(error).toBeDefined();
        expect(error.details[0].path).toContain('id');
      });

      it('should fail with wrong length ID', () => {
        const data = {
          id: 'a1b2c3d4'
        };

        const { error } = paramSchemas.id.validate(data);
        expect(error).toBeDefined();
        expect(error.details[0].path).toContain('id');
      });
    });
  });
});