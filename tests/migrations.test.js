const dbConnection = require('../src/config/database');
const migrationManager = require('../src/config/migrations');
const fs = require('fs');
const path = require('path');

describe('Database Migration System', () => {
  const testDbPath = path.join(process.cwd(), 'database', 'test-migrations.db');
  
  beforeAll(async () => {
    // Use a test database
    dbConnection.dbPath = testDbPath;
    dbConnection.connect();
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

  beforeEach(async () => {
    // Reset migration state before each test
    try {
      const db = dbConnection.getDatabase();
      db.exec('DROP TABLE IF EXISTS migrations');
      db.exec('DROP TABLE IF EXISTS completed_notes');
      db.exec('DROP TABLE IF EXISTS notes');
      db.exec('DROP TABLE IF EXISTS groups');
      db.exec('DROP TABLE IF EXISTS users');
    } catch (error) {
      // Ignore errors if tables don't exist
    }
  });

  describe('Migration Manager Initialization', () => {
    test('should initialize migration system', async () => {
      await migrationManager.initialize();
      
      // Check if migrations table exists
      const db = dbConnection.getDatabase();
      const result = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='migrations'
      `).get();
      
      expect(result).toBeDefined();
      expect(result.name).toBe('migrations');
    });

    test('should load migrations', async () => {
      await migrationManager.initialize();
      expect(migrationManager.migrations).toHaveLength(2);
      expect(migrationManager.migrations[0].version).toBe('001');
      expect(migrationManager.migrations[1].version).toBe('002');
    });
  });

  describe('Migration Execution', () => {
    beforeEach(async () => {
      await migrationManager.initialize();
    });

    test('should run all pending migrations', async () => {
      const migrationsRun = await migrationManager.migrate();
      expect(migrationsRun).toBe(2);
      
      // Check if tables were created
      const db = dbConnection.getDatabase();
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'migrations'
        ORDER BY name
      `).all();
      
      const tableNames = tables.map(t => t.name);
      expect(tableNames).toEqual(['completed_notes', 'groups', 'notes', 'users']);
    });

    test('should not run already executed migrations', async () => {
      // Run migrations first time
      await migrationManager.migrate();
      
      // Run migrations second time
      const migrationsRun = await migrationManager.migrate();
      expect(migrationsRun).toBe(0);
    });

    test('should record migration execution', async () => {
      await migrationManager.migrate();
      
      const executedMigrations = await migrationManager.getExecutedMigrations();
      expect(executedMigrations).toHaveLength(2);
      expect(executedMigrations[0].version).toBe('001');
      expect(executedMigrations[1].version).toBe('002');
    });

    test('should check if migration is executed', async () => {
      await migrationManager.migrate();
      
      const isExecuted = await migrationManager.isMigrationExecuted('001');
      expect(isExecuted).toBe(true);
      
      const isNotExecuted = await migrationManager.isMigrationExecuted('999');
      expect(isNotExecuted).toBe(false);
    });
  });

  describe('Migration Status', () => {
    beforeEach(async () => {
      await migrationManager.initialize();
    });

    test('should get migration status', async () => {
      const statusBefore = await migrationManager.getStatus();
      expect(statusBefore.total).toBe(2);
      expect(statusBefore.executed).toBe(0);
      expect(statusBefore.pending).toBe(2);
      
      await migrationManager.migrate();
      
      const statusAfter = await migrationManager.getStatus();
      expect(statusAfter.total).toBe(2);
      expect(statusAfter.executed).toBe(2);
      expect(statusAfter.pending).toBe(0);
    });

    test('should show detailed migration status', async () => {
      await migrationManager.migrate();
      
      const status = await migrationManager.getStatus();
      expect(status.migrations).toHaveLength(2);
      
      const migration001 = status.migrations.find(m => m.version === '001');
      expect(migration001.executed).toBe(true);
      expect(migration001.executedAt).toBeDefined();
      
      const migration002 = status.migrations.find(m => m.version === '002');
      expect(migration002.executed).toBe(true);
      expect(migration002.executedAt).toBeDefined();
    });
  });

  describe('Migration Rollback', () => {
    beforeEach(async () => {
      await migrationManager.initialize();
      await migrationManager.migrate();
    });

    test('should rollback last migration', async () => {
      const success = await migrationManager.rollback();
      expect(success).toBe(true);
      
      const status = await migrationManager.getStatus();
      expect(status.executed).toBe(1);
      expect(status.pending).toBe(1);
      
      // Check that indexes were removed
      const db = dbConnection.getDatabase();
      const indexes = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name LIKE 'idx_%'
      `).all();
      
      expect(indexes).toHaveLength(0);
    });

    test('should not rollback when no migrations exist', async () => {
      // Rollback all migrations first
      await migrationManager.rollback();
      await migrationManager.rollback();
      
      const success = await migrationManager.rollback();
      expect(success).toBe(false);
    });

    test('should remove migration record on rollback', async () => {
      await migrationManager.rollback();
      
      const isExecuted = await migrationManager.isMigrationExecuted('002');
      expect(isExecuted).toBe(false);
    });
  });

  describe('Database Reset', () => {
    beforeEach(async () => {
      await migrationManager.initialize();
      await migrationManager.migrate();
    });

    test('should reset database completely', async () => {
      await migrationManager.reset();
      
      const status = await migrationManager.getStatus();
      expect(status.executed).toBe(0);
      expect(status.pending).toBe(2);
      
      // Check that all tables were removed
      const db = dbConnection.getDatabase();
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'migrations'
      `).all();
      
      expect(tables).toHaveLength(0);
    });
  });

  describe('Individual Migration Tests', () => {
    beforeEach(async () => {
      await migrationManager.initialize();
    });

    test('should create all tables in migration 001', async () => {
      await migrationManager.migration001Up();
      
      const db = dbConnection.getDatabase();
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'migrations'
        ORDER BY name
      `).all();
      
      const tableNames = tables.map(t => t.name);
      expect(tableNames).toEqual(['completed_notes', 'groups', 'notes', 'users']);
    });

    test('should create all indexes in migration 002', async () => {
      await migrationManager.migration001Up();
      await migrationManager.migration002Up();
      
      const db = dbConnection.getDatabase();
      const indexes = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name LIKE 'idx_%'
        ORDER BY name
      `).all();
      
      expect(indexes.length).toBeGreaterThan(0);
      
      const indexNames = indexes.map(idx => idx.name);
      expect(indexNames).toContain('idx_notes_user_id');
      expect(indexNames).toContain('idx_users_email');
    });

    test('should rollback migration 001', async () => {
      await migrationManager.migration001Up();
      await migrationManager.migration001Down();
      
      const db = dbConnection.getDatabase();
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'migrations'
      `).all();
      
      expect(tables).toHaveLength(0);
    });

    test('should rollback migration 002', async () => {
      await migrationManager.migration001Up();
      await migrationManager.migration002Up();
      await migrationManager.migration002Down();
      
      const db = dbConnection.getDatabase();
      const indexes = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name LIKE 'idx_%'
      `).all();
      
      expect(indexes).toHaveLength(0);
    });
  });
});