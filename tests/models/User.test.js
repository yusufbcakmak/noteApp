const User = require('../../src/models/User');
const bcrypt = require('bcrypt');

describe('User Model', () => {
  describe('Constructor', () => {
    it('should create a user with default values', () => {
      const user = new User();
      
      expect(user.id).toBeNull();
      expect(user.email).toBeNull();
      expect(user.password).toBeNull();
      expect(user.firstName).toBeNull();
      expect(user.lastName).toBeNull();
      expect(user.isActive).toBe(true);
      expect(user.createdAt).toBeNull();
      expect(user.updatedAt).toBeNull();
      expect(user.lastLoginAt).toBeNull();
    });

    it('should create a user with provided data', () => {
      const userData = {
        id: 'test-id',
        email: 'test@example.com',
        password: 'hashedpassword',
        firstName: 'John',
        lastName: 'Doe',
        isActive: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        lastLoginAt: '2024-01-01T00:00:00Z'
      };

      const user = new User(userData);
      
      expect(user.id).toBe('test-id');
      expect(user.email).toBe('test@example.com');
      expect(user.password).toBe('hashedpassword');
      expect(user.firstName).toBe('John');
      expect(user.lastName).toBe('Doe');
      expect(user.isActive).toBe(false);
      expect(user.createdAt).toBe('2024-01-01T00:00:00Z');
      expect(user.updatedAt).toBe('2024-01-01T00:00:00Z');
      expect(user.lastLoginAt).toBe('2024-01-01T00:00:00Z');
    });

    it('should handle database format field names', () => {
      const userData = {
        id: 'test-id',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        is_active: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        last_login_at: '2024-01-01T00:00:00Z'
      };

      const user = new User(userData);
      
      expect(user.firstName).toBe('John');
      expect(user.lastName).toBe('Doe');
      expect(user.isActive).toBe(true);
      expect(user.createdAt).toBe('2024-01-01T00:00:00Z');
      expect(user.updatedAt).toBe('2024-01-01T00:00:00Z');
      expect(user.lastLoginAt).toBe('2024-01-01T00:00:00Z');
    });
  });

  describe('Validation Schemas', () => {
    describe('registrationSchema', () => {
      it('should validate valid registration data', () => {
        const validData = {
          email: 'test@example.com',
          password: 'Password123',
          firstName: 'John',
          lastName: 'Doe'
        };

        const { error } = User.registrationSchema.validate(validData);
        expect(error).toBeUndefined();
      });

      it('should reject invalid email', () => {
        const invalidData = {
          email: 'invalid-email',
          password: 'Password123',
          firstName: 'John',
          lastName: 'Doe'
        };

        const { error } = User.registrationSchema.validate(invalidData);
        expect(error).toBeDefined();
        expect(error.details[0].message).toContain('valid email address');
      });

      it('should reject weak password', () => {
        const invalidData = {
          email: 'test@example.com',
          password: 'weak',
          firstName: 'John',
          lastName: 'Doe'
        };

        const { error } = User.registrationSchema.validate(invalidData);
        expect(error).toBeDefined();
        expect(error.details[0].message).toContain('at least 8 characters');
      });

      it('should reject password without uppercase, lowercase, and number', () => {
        const invalidData = {
          email: 'test@example.com',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe'
        };

        const { error } = User.registrationSchema.validate(invalidData);
        expect(error).toBeDefined();
        expect(error.details[0].message).toContain('uppercase letter');
      });

      it('should reject missing required fields', () => {
        const invalidData = {
          email: 'test@example.com'
        };

        const { error } = User.registrationSchema.validate(invalidData);
        expect(error).toBeDefined();
        expect(error.details.length).toBeGreaterThan(0);
      });
    });

    describe('loginSchema', () => {
      it('should validate valid login data', () => {
        const validData = {
          email: 'test@example.com',
          password: 'anypassword'
        };

        const { error } = User.loginSchema.validate(validData);
        expect(error).toBeUndefined();
      });

      it('should reject missing email', () => {
        const invalidData = {
          password: 'anypassword'
        };

        const { error } = User.loginSchema.validate(invalidData);
        expect(error).toBeDefined();
        expect(error.details[0].message).toContain('Email is required');
      });

      it('should reject missing password', () => {
        const invalidData = {
          email: 'test@example.com'
        };

        const { error } = User.loginSchema.validate(invalidData);
        expect(error).toBeDefined();
        expect(error.details[0].message).toContain('Password is required');
      });
    });

    describe('updateSchema', () => {
      it('should validate valid update data', () => {
        const validData = {
          firstName: 'John',
          lastName: 'Doe',
          email: 'newemail@example.com'
        };

        const { error } = User.updateSchema.validate(validData);
        expect(error).toBeUndefined();
      });

      it('should allow partial updates', () => {
        const validData = {
          firstName: 'John'
        };

        const { error } = User.updateSchema.validate(validData);
        expect(error).toBeUndefined();
      });

      it('should reject invalid email in update', () => {
        const invalidData = {
          email: 'invalid-email'
        };

        const { error } = User.updateSchema.validate(invalidData);
        expect(error).toBeDefined();
        expect(error.details[0].message).toContain('valid email address');
      });
    });

    describe('passwordChangeSchema', () => {
      it('should validate valid password change data', () => {
        const validData = {
          currentPassword: 'oldPassword',
          newPassword: 'NewPassword123'
        };

        const { error } = User.passwordChangeSchema.validate(validData);
        expect(error).toBeUndefined();
      });

      it('should reject weak new password', () => {
        const invalidData = {
          currentPassword: 'oldPassword',
          newPassword: 'weak'
        };

        const { error } = User.passwordChangeSchema.validate(invalidData);
        expect(error).toBeDefined();
        expect(error.details[0].message).toContain('at least 8 characters');
      });
    });
  });

  describe('Password Methods', () => {
    describe('hashPassword', () => {
      it('should hash password correctly', async () => {
        const password = 'TestPassword123';
        const hash = await User.hashPassword(password);
        
        expect(hash).toBeDefined();
        expect(hash).not.toBe(password);
        expect(hash.length).toBeGreaterThan(50);
      });

      it('should generate different hashes for same password', async () => {
        const password = 'TestPassword123';
        const hash1 = await User.hashPassword(password);
        const hash2 = await User.hashPassword(password);
        
        expect(hash1).not.toBe(hash2);
      });
    });

    describe('comparePassword', () => {
      it('should return true for correct password', async () => {
        const password = 'TestPassword123';
        const hash = await User.hashPassword(password);
        const isMatch = await User.comparePassword(password, hash);
        
        expect(isMatch).toBe(true);
      });

      it('should return false for incorrect password', async () => {
        const password = 'TestPassword123';
        const wrongPassword = 'WrongPassword123';
        const hash = await User.hashPassword(password);
        const isMatch = await User.comparePassword(wrongPassword, hash);
        
        expect(isMatch).toBe(false);
      });
    });
  });

  describe('Instance Methods', () => {
    let user;

    beforeEach(() => {
      user = new User({
        id: 'test-id',
        email: 'test@example.com',
        password: 'hashedpassword',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      });
    });

    describe('toJSON', () => {
      it('should return user data without sensitive information', () => {
        const json = user.toJSON();
        
        expect(json.id).toBe('test-id');
        expect(json.email).toBe('test@example.com');
        expect(json.firstName).toBe('John');
        expect(json.lastName).toBe('Doe');
        expect(json.password).toBeUndefined();
      });

      it('should include sensitive information when requested', () => {
        const json = user.toJSON(true);
        
        expect(json.password).toBe('hashedpassword');
      });
    });

    describe('toDatabaseFormat', () => {
      it('should convert to database format', () => {
        const dbFormat = user.toDatabaseFormat();
        
        expect(dbFormat.first_name).toBe('John');
        expect(dbFormat.last_name).toBe('Doe');
        expect(dbFormat.is_active).toBe(1);
        expect(dbFormat.created_at).toBe('2024-01-01T00:00:00Z');
        expect(dbFormat.updated_at).toBe('2024-01-01T00:00:00Z');
      });
    });

    describe('fromDatabaseRow', () => {
      it('should create user from database row', () => {
        const row = {
          id: 'test-id',
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe',
          is_active: 1,
          created_at: '2024-01-01T00:00:00Z'
        };

        const user = User.fromDatabaseRow(row);
        
        expect(user).toBeInstanceOf(User);
        expect(user.firstName).toBe('John');
        expect(user.lastName).toBe('Doe');
        expect(user.isActive).toBe(true);
      });

      it('should return null for null row', () => {
        const user = User.fromDatabaseRow(null);
        expect(user).toBeNull();
      });
    });

    describe('getFullName', () => {
      it('should return full name', () => {
        const fullName = user.getFullName();
        expect(fullName).toBe('John Doe');
      });

      it('should handle missing names gracefully', () => {
        const userWithoutNames = new User({});
        const fullName = userWithoutNames.getFullName();
        expect(fullName).toBe('');
      });
    });

    describe('isUserActive', () => {
      it('should return true for active user', () => {
        expect(user.isUserActive()).toBe(true);
      });

      it('should return false for inactive user', () => {
        user.isActive = false;
        expect(user.isUserActive()).toBe(false);
      });
    });

    describe('updateLastLogin', () => {
      it('should update last login timestamp', () => {
        const beforeUpdate = user.lastLoginAt;
        user.updateLastLogin();
        
        expect(user.lastLoginAt).not.toBe(beforeUpdate);
        expect(new Date(user.lastLoginAt)).toBeInstanceOf(Date);
      });
    });
  });

  describe('Static Methods', () => {
    describe('validate', () => {
      it('should validate data against schema', () => {
        const data = {
          email: 'test@example.com',
          password: 'Password123',
          firstName: 'John',
          lastName: 'Doe'
        };

        const result = User.validate(data, User.registrationSchema);
        expect(result.error).toBeUndefined();
        expect(result.value).toEqual(data);
      });

      it('should return validation errors', () => {
        const data = {
          email: 'invalid-email'
        };

        const result = User.validate(data, User.registrationSchema);
        expect(result.error).toBeDefined();
        expect(result.error.details.length).toBeGreaterThan(0);
      });
    });
  });
});