const UserRepository = require('../../src/repositories/UserRepository');
const User = require('../../src/models/User');
const dbConnection = require('../../src/config/database');
const fs = require('fs');
const path = require('path');

describe('UserRepository', () => {
  let userRepository;
  let testDbPath;

  beforeAll(async () => {
    // Create a test database
    testDbPath = path.join(__dirname, '../test-db.sqlite');
    
    // Remove existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Override database path for testing
    dbConnection.dbPath = testDbPath;
    dbConnection.connect();

    // Create users table
    const createTableQuery = `
      CREATE TABLE users (
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

    dbConnection.getDatabase().exec(createTableQuery);

    userRepository = new UserRepository().init();
  });

  afterAll(async () => {
    // Close database connection
    dbConnection.close();
    
    // Remove test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  beforeEach(async () => {
    // Clear users table before each test
    dbConnection.getDatabase().exec('DELETE FROM users');
  });

  describe('create', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const user = await userRepository.create(userData);

      expect(user).toBeInstanceOf(User);
      expect(user.id).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.firstName).toBe('John');
      expect(user.lastName).toBe('Doe');
      expect(user.password).not.toBe('Password123'); // Should be hashed
      expect(user.isActive).toBe(true);
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
    });

    it('should throw error for duplicate email', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      await userRepository.create(userData);

      await expect(userRepository.create(userData))
        .rejects.toThrow('Email already exists');
    });

    it('should generate ID if not provided', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const user = await userRepository.create(userData);
      expect(user.id).toBeDefined();
      expect(user.id.length).toBe(32); // 16 bytes = 32 hex characters
    });
  });

  describe('findById', () => {
    it('should find user by ID', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const createdUser = await userRepository.create(userData);
      const foundUser = await userRepository.findById(createdUser.id);

      expect(foundUser).toBeInstanceOf(User);
      expect(foundUser.id).toBe(createdUser.id);
      expect(foundUser.email).toBe('test@example.com');
    });

    it('should return null for non-existent ID', async () => {
      const user = await userRepository.findById('non-existent-id');
      expect(user).toBeNull();
    });

    it('should not find inactive users', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const createdUser = await userRepository.create(userData);
      await userRepository.softDelete(createdUser.id);

      const foundUser = await userRepository.findById(createdUser.id);
      expect(foundUser).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      await userRepository.create(userData);
      const foundUser = await userRepository.findByEmail('test@example.com');

      expect(foundUser).toBeInstanceOf(User);
      expect(foundUser.email).toBe('test@example.com');
    });

    it('should be case insensitive', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      await userRepository.create(userData);
      const foundUser = await userRepository.findByEmail('TEST@EXAMPLE.COM');

      expect(foundUser).toBeInstanceOf(User);
      expect(foundUser.email).toBe('test@example.com');
    });

    it('should return null for non-existent email', async () => {
      const user = await userRepository.findByEmail('nonexistent@example.com');
      expect(user).toBeNull();
    });
  });

  describe('findByEmailIncludingInactive', () => {
    it('should find inactive users', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const createdUser = await userRepository.create(userData);
      await userRepository.softDelete(createdUser.id);

      const foundUser = await userRepository.findByEmailIncludingInactive('test@example.com');
      expect(foundUser).toBeInstanceOf(User);
      expect(foundUser.isActive).toBe(false);
    });
  });

  describe('update', () => {
    it('should update user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const createdUser = await userRepository.create(userData);
      const updateData = {
        firstName: 'Jane',
        lastName: 'Smith'
      };

      const updatedUser = await userRepository.update(createdUser.id, updateData);

      expect(updatedUser.firstName).toBe('Jane');
      expect(updatedUser.lastName).toBe('Smith');
      expect(updatedUser.email).toBe('test@example.com'); // Should remain unchanged
      expect(updatedUser.updatedAt).not.toBe(createdUser.updatedAt);
    });

    it('should hash password when updating', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const createdUser = await userRepository.create(userData);
      const updateData = {
        password: 'NewPassword123'
      };

      const updatedUser = await userRepository.update(createdUser.id, updateData);

      expect(updatedUser.password).not.toBe('NewPassword123');
      expect(updatedUser.password).not.toBe(createdUser.password);
    });

    it('should return null for non-existent user', async () => {
      const updateData = {
        firstName: 'Jane'
      };

      const result = await userRepository.update('non-existent-id', updateData);
      expect(result).toBeNull();
    });

    it('should throw error for duplicate email', async () => {
      // Create first user
      await userRepository.create({
        email: 'user1@example.com',
        password: 'Password123',
        firstName: 'User',
        lastName: 'One'
      });

      // Create second user
      const user2 = await userRepository.create({
        email: 'user2@example.com',
        password: 'Password123',
        firstName: 'User',
        lastName: 'Two'
      });

      // Try to update second user with first user's email
      await expect(userRepository.update(user2.id, { email: 'user1@example.com' }))
        .rejects.toThrow('Email already exists');
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const createdUser = await userRepository.create(userData);
      const result = await userRepository.updateLastLogin(createdUser.id);

      expect(result).toBe(true);

      const updatedUser = await userRepository.findById(createdUser.id);
      expect(updatedUser.lastLoginAt).toBeDefined();
      expect(updatedUser.lastLoginAt).not.toBe(createdUser.lastLoginAt);
    });

    it('should return false for non-existent user', async () => {
      const result = await userRepository.updateLastLogin('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('softDelete', () => {
    it('should soft delete user', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const createdUser = await userRepository.create(userData);
      const result = await userRepository.softDelete(createdUser.id);

      expect(result).toBe(true);

      const foundUser = await userRepository.findById(createdUser.id);
      expect(foundUser).toBeNull();

      const inactiveUser = await userRepository.findByEmailIncludingInactive('test@example.com');
      expect(inactiveUser.isActive).toBe(false);
    });

    it('should return false for non-existent user', async () => {
      const result = await userRepository.softDelete('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('hardDelete', () => {
    it('should permanently delete user', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const createdUser = await userRepository.create(userData);
      const result = await userRepository.hardDelete(createdUser.id);

      expect(result).toBe(true);

      const foundUser = await userRepository.findByEmailIncludingInactive('test@example.com');
      expect(foundUser).toBeNull();
    });

    it('should return false for non-existent user', async () => {
      const result = await userRepository.hardDelete('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('emailExists', () => {
    it('should return true for existing email', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      await userRepository.create(userData);
      const exists = await userRepository.emailExists('test@example.com');

      expect(exists).toBe(true);
    });

    it('should return false for non-existing email', async () => {
      const exists = await userRepository.emailExists('nonexistent@example.com');
      expect(exists).toBe(false);
    });

    it('should exclude specified user ID', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const createdUser = await userRepository.create(userData);
      const exists = await userRepository.emailExists('test@example.com', createdUser.id);

      expect(exists).toBe(false);
    });
  });

  describe('getCount', () => {
    it('should return correct user count', async () => {
      expect(await userRepository.getCount()).toBe(0);

      await userRepository.create({
        email: 'user1@example.com',
        password: 'Password123',
        firstName: 'User',
        lastName: 'One'
      });

      expect(await userRepository.getCount()).toBe(1);

      await userRepository.create({
        email: 'user2@example.com',
        password: 'Password123',
        firstName: 'User',
        lastName: 'Two'
      });

      expect(await userRepository.getCount()).toBe(2);
    });

    it('should not count inactive users', async () => {
      const user = await userRepository.create({
        email: 'user1@example.com',
        password: 'Password123',
        firstName: 'User',
        lastName: 'One'
      });

      expect(await userRepository.getCount()).toBe(1);

      await userRepository.softDelete(user.id);
      expect(await userRepository.getCount()).toBe(0);
    });
  });

  describe('findWithPagination', () => {
    beforeEach(async () => {
      // Create test users
      for (let i = 1; i <= 15; i++) {
        await userRepository.create({
          email: `user${i}@example.com`,
          password: 'Password123',
          firstName: `User${i}`,
          lastName: 'Test'
        });
      }
    });

    it('should return paginated results', async () => {
      const result = await userRepository.findWithPagination({ page: 1, limit: 10 });

      expect(result.users).toHaveLength(10);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.total).toBe(15);
      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(false);
    });

    it('should return second page correctly', async () => {
      const result = await userRepository.findWithPagination({ page: 2, limit: 10 });

      expect(result.users).toHaveLength(5);
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrev).toBe(true);
    });

    it('should filter by search term', async () => {
      const result = await userRepository.findWithPagination({ search: 'User1' });

      expect(result.users.length).toBeGreaterThan(0);
      result.users.forEach(user => {
        expect(
          user.firstName.includes('User1') || 
          user.lastName.includes('User1') || 
          user.email.includes('user1')
        ).toBe(true);
      });
    });
  });
});