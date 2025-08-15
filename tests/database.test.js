const dbConnection = require('../src/config/database');
const dbInitializer = require('../src/config/init-database');
const fs = require('fs');
const path = require('path');

describe('Database Connection and Initialization', () => {
  const testDbPath = path.join(process.cwd(), 'database', 'test-notes.db');
  
  beforeAll(async () => {
    // Use a test database
    dbConnection.dbPath = testDbPath;
  });

  afterAll(async () => {
    // Clean up test database
    dbConnection.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    // Clean up WAL and SHM files
    const walFile = testDbPath + '-wal';
    const shmFile = testDbPath + '-shm';
    if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
    if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile);
  });

  describe('Database Connection', () => {
    test('should connect to database successfully', () => {
      const db = dbConnection.connect();
      expect(db).toBeDefined();
      expect(dbConnection.isConnected()).toBe(true);
    });

    test('should enable WAL mode', () => {
      const db = dbConnection.getDatabase();
      const journalMode = db.pragma('journal_mode', { simple: true });
      expect(journalMode).toBe('wal');
    });

    test('should enable foreign keys', () => {
      const db = dbConnection.getDatabase();
      const foreignKeys = db.pragma('foreign_keys', { simple: true });
      expect(foreignKeys).toBe(1);
    });

    test('should throw error when getting database before connection', () => {
      const tempConnection = require('../src/config/database');
      tempConnection.db = null;
      expect(() => tempConnection.getDatabase()).toThrow('Database not initialized');
    });
  });

  describe('Database Queries', () => {
    beforeAll(async () => {
      await dbInitializer.initialize();
    });

    test('should execute query successfully', () => {
      const result = dbConnection.executeQuery(
        'INSERT INTO users (email, password, first_name) VALUES (?, ?, ?)',
        ['test@example.com', 'hashedpassword', 'Test']
      );
      expect(result.changes).toBe(1);
    });

    test('should get query results', () => {
      const user = dbConnection.getQuery(
        'SELECT * FROM users WHERE email = ?',
        ['test@example.com']
      );
      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.first_name).toBe('Test');
    });

    test('should get all query results', () => {
      // Insert another user
      dbConnection.executeQuery(
        'INSERT INTO users (email, password, first_name) VALUES (?, ?, ?)',
        ['test2@example.com', 'hashedpassword2', 'Test2']
      );

      const users = dbConnection.getAllQuery('SELECT * FROM users');
      expect(users).toHaveLength(2);
      expect(users[0].email).toBe('test@example.com');
      expect(users[1].email).toBe('test2@example.com');
    });

    test('should handle query errors', () => {
      expect(() => {
        dbConnection.executeQuery('INVALID SQL QUERY');
      }).toThrow();
    });
  });

  describe('Database Initialization', () => {
    test('should initialize database successfully', async () => {
      const result = await dbInitializer.initialize();
      expect(result).toBe(true);
    });

    test('should create all required tables', async () => {
      const tableCheck = await dbInitializer.checkTablesExist();
      expect(tableCheck.allExist).toBe(true);
      expect(tableCheck.existing).toEqual(['users', 'groups', 'notes', 'completed_notes']);
      expect(tableCheck.missing).toEqual([]);
    });

    test('should create indexes', async () => {
      const schemaInfo = await dbInitializer.getSchemaInfo();
      expect(schemaInfo.indexes.length).toBeGreaterThan(0);
      
      // Check for specific indexes
      const indexNames = schemaInfo.indexes.map(idx => idx.name);
      expect(indexNames).toContain('idx_notes_user_id');
      expect(indexNames).toContain('idx_users_email');
    });

    test('should get schema information', async () => {
      const schemaInfo = await dbInitializer.getSchemaInfo();
      expect(schemaInfo.tables).toEqual(['completed_notes', 'groups', 'migrations', 'notes', 'users']);
      expect(schemaInfo.indexes).toBeDefined();
      expect(Array.isArray(schemaInfo.indexes)).toBe(true);
    });
  });

  describe('Database Transactions', () => {
    beforeAll(async () => {
      await dbInitializer.initialize();
    });

    test('should execute transaction successfully', () => {
      // First create a user to get a valid user_id
      const userResult = dbConnection.executeQuery(
        'INSERT INTO users (email, password, first_name) VALUES (?, ?, ?)',
        ['transaction@example.com', 'hashedpassword', 'Transaction']
      );
      
      // Get the created user to get the actual user_id
      const user = dbConnection.getQuery(
        'SELECT id FROM users WHERE email = ?',
        ['transaction@example.com']
      );

      const statements = [
        {
          query: 'INSERT INTO groups (user_id, name) VALUES (?, ?)',
          params: [user.id, 'Test Group']
        }
      ];

      expect(() => {
        dbConnection.executeTransaction(statements);
      }).not.toThrow();
    });
  });

  describe('Database Connection Management', () => {
    test('should close connection successfully', () => {
      dbConnection.close();
      expect(dbConnection.isConnected()).toBe(false);
    });

    test('should reconnect after closing', () => {
      const db = dbConnection.connect();
      expect(db).toBeDefined();
      expect(dbConnection.isConnected()).toBe(true);
    });
  });
});