const dbConnection = require('./database');

/**
 * Database Migration System
 * Handles database schema versioning and migrations
 */
class MigrationManager {
  constructor() {
    this.db = null;
    this.migrations = [];
  }

  /**
   * Initialize migration system
   */
  async initialize() {
    this.db = dbConnection.getDatabase();
    await this.createMigrationsTable();
    this.loadMigrations();
  }

  /**
   * Create migrations tracking table
   */
  async createMigrationsTable() {
    const createMigrationsTableSQL = `
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    this.db.exec(createMigrationsTableSQL);
    console.log('✓ Migrations table created');
  }

  /**
   * Load all available migrations
   */
  loadMigrations() {
    this.migrations = [
      {
        version: '001',
        name: 'initial_schema',
        up: this.migration001Up.bind(this),
        down: this.migration001Down.bind(this)
      },
      {
        version: '002',
        name: 'add_indexes',
        up: this.migration002Up.bind(this),
        down: this.migration002Down.bind(this)
      },
      {
        version: '003',
        name: 'add_archived_status',
        up: this.migration003Up.bind(this),
        down: this.migration003Down.bind(this)
      }
    ];
  }

  /**
   * Migration 001: Initial schema
   */
  async migration001Up() {
    const migrations = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active INTEGER DEFAULT 1,
        last_login_at DATETIME
      )`,
      
      // Groups table
      `CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT DEFAULT '#3498db',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      
      // Notes table
      `CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL,
        group_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
        priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL
      )`,
      
      // Completed notes table
      `CREATE TABLE IF NOT EXISTS completed_notes (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL,
        original_note_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        group_name TEXT,
        priority TEXT NOT NULL,
        completed_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`
    ];

    for (const sql of migrations) {
      this.db.exec(sql);
    }
    
    console.log('✓ Migration 001: Initial schema applied');
  }

  /**
   * Migration 001 rollback
   */
  async migration001Down() {
    const tables = ['completed_notes', 'notes', 'groups', 'users'];
    
    for (const table of tables) {
      this.db.exec(`DROP TABLE IF EXISTS ${table}`);
    }
    
    console.log('✓ Migration 001: Initial schema rolled back');
  }

  /**
   * Migration 002: Add performance indexes
   */
  async migration002Up() {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_notes_status ON notes(status)',
      'CREATE INDEX IF NOT EXISTS idx_notes_priority ON notes(priority)',
      'CREATE INDEX IF NOT EXISTS idx_notes_group_id ON notes(group_id)',
      'CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_groups_user_id ON groups(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_completed_notes_user_id ON completed_notes(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_completed_notes_completed_at ON completed_notes(completed_at)',
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at)'
    ];

    for (const indexSQL of indexes) {
      this.db.exec(indexSQL);
    }
    
    console.log('✓ Migration 002: Performance indexes applied');
  }

  /**
   * Migration 002 rollback
   */
  async migration002Down() {
    const indexes = [
      'idx_notes_user_id',
      'idx_notes_status',
      'idx_notes_priority',
      'idx_notes_group_id',
      'idx_notes_created_at',
      'idx_groups_user_id',
      'idx_completed_notes_user_id',
      'idx_completed_notes_completed_at',
      'idx_users_email',
      'idx_users_is_active',
      'idx_users_created_at'
    ];

    for (const index of indexes) {
      this.db.exec(`DROP INDEX IF EXISTS ${index}`);
    }
    
    console.log('✓ Migration 002: Performance indexes rolled back');
  }

  /**
   * Migration 003: Add archived status to notes table
   */
  async migration003Up() {
    // Since SQLite doesn't support ALTER COLUMN with CHECK constraints,
    // we need to recreate the table with the new constraint
    
    // 1. Create new table with updated constraint
    this.db.exec(`
      CREATE TABLE notes_new (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL,
        group_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'archived')),
        priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL
      )
    `);
    
    // 2. Copy data from old table to new table
    this.db.exec(`
      INSERT INTO notes_new (id, user_id, group_id, title, description, status, priority, created_at, updated_at, completed_at)
      SELECT id, user_id, group_id, title, description, status, priority, created_at, updated_at, completed_at
      FROM notes
    `);
    
    // 3. Drop old table
    this.db.exec('DROP TABLE notes');
    
    // 4. Rename new table to original name
    this.db.exec('ALTER TABLE notes_new RENAME TO notes');
    
    // 5. Recreate indexes on notes table
    const noteIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_notes_status ON notes(status)',
      'CREATE INDEX IF NOT EXISTS idx_notes_priority ON notes(priority)',
      'CREATE INDEX IF NOT EXISTS idx_notes_group_id ON notes(group_id)',
      'CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at)'
    ];

    for (const indexSQL of noteIndexes) {
      this.db.exec(indexSQL);
    }
    
    console.log('✓ Migration 003: Added archived status to notes table');
  }

  /**
   * Migration 003 rollback
   */
  async migration003Down() {
    // Recreate table with old constraint (without 'archived')
    
    // 1. Create table with old constraint
    this.db.exec(`
      CREATE TABLE notes_old (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL,
        group_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
        priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL
      )
    `);
    
    // 2. Copy data (excluding archived notes)
    this.db.exec(`
      INSERT INTO notes_old (id, user_id, group_id, title, description, status, priority, created_at, updated_at, completed_at)
      SELECT id, user_id, group_id, title, description, status, priority, created_at, updated_at, completed_at
      FROM notes
      WHERE status != 'archived'
    `);
    
    // 3. Drop current table
    this.db.exec('DROP TABLE notes');
    
    // 4. Rename old table to original name
    this.db.exec('ALTER TABLE notes_old RENAME TO notes');
    
    // 5. Recreate indexes
    const noteIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_notes_status ON notes(status)',
      'CREATE INDEX IF NOT EXISTS idx_notes_priority ON notes(priority)',
      'CREATE INDEX IF NOT EXISTS idx_notes_group_id ON notes(group_id)',
      'CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at)'
    ];

    for (const indexSQL of noteIndexes) {
      this.db.exec(indexSQL);
    }
    
    console.log('✓ Migration 003: Removed archived status from notes table');
  }

  /**
   * Get executed migrations
   */
  async getExecutedMigrations() {
    const result = this.db.prepare(`
      SELECT version, name, executed_at 
      FROM migrations 
      ORDER BY version
    `).all();
    
    return result;
  }

  /**
   * Check if migration has been executed
   */
  async isMigrationExecuted(version) {
    const result = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM migrations 
      WHERE version = ?
    `).get(version);
    
    return result.count > 0;
  }

  /**
   * Record migration execution
   */
  async recordMigration(version, name) {
    this.db.prepare(`
      INSERT INTO migrations (version, name) 
      VALUES (?, ?)
    `).run(version, name);
  }

  /**
   * Remove migration record
   */
  async removeMigrationRecord(version) {
    this.db.prepare(`
      DELETE FROM migrations 
      WHERE version = ?
    `).run(version);
  }

  /**
   * Run all pending migrations
   */
  async migrate() {
    console.log('🚀 Starting database migrations...');
    
    let migrationsRun = 0;
    
    for (const migration of this.migrations) {
      const isExecuted = await this.isMigrationExecuted(migration.version);
      
      if (!isExecuted) {
        console.log(`Running migration ${migration.version}: ${migration.name}`);
        
        try {
          await migration.up();
          await this.recordMigration(migration.version, migration.name);
          migrationsRun++;
        } catch (error) {
          console.error(`Migration ${migration.version} failed:`, error);
          throw error;
        }
      } else {
        console.log(`Migration ${migration.version}: ${migration.name} already executed`);
      }
    }
    
    if (migrationsRun > 0) {
      console.log(`✅ ${migrationsRun} migrations executed successfully`);
    } else {
      console.log('✅ Database is up to date');
    }
    
    return migrationsRun;
  }

  /**
   * Rollback last migration
   */
  async rollback() {
    const executedMigrations = await this.getExecutedMigrations();
    
    if (executedMigrations.length === 0) {
      console.log('No migrations to rollback');
      return false;
    }
    
    const lastMigration = executedMigrations[executedMigrations.length - 1];
    const migration = this.migrations.find(m => m.version === lastMigration.version);
    
    if (!migration) {
      throw new Error(`Migration ${lastMigration.version} not found`);
    }
    
    console.log(`Rolling back migration ${migration.version}: ${migration.name}`);
    
    try {
      await migration.down();
      await this.removeMigrationRecord(migration.version);
      console.log(`✅ Migration ${migration.version} rolled back successfully`);
      return true;
    } catch (error) {
      console.error(`Rollback of migration ${migration.version} failed:`, error);
      throw error;
    }
  }

  /**
   * Get migration status
   */
  async getStatus() {
    const executedMigrations = await this.getExecutedMigrations();
    const executedVersions = executedMigrations.map(m => m.version);
    
    const status = this.migrations.map(migration => ({
      version: migration.version,
      name: migration.name,
      executed: executedVersions.includes(migration.version),
      executedAt: executedMigrations.find(m => m.version === migration.version)?.executed_at
    }));
    
    return {
      total: this.migrations.length,
      executed: executedMigrations.length,
      pending: this.migrations.length - executedMigrations.length,
      migrations: status
    };
  }

  /**
   * Reset database (rollback all migrations)
   */
  async reset() {
    console.log('⚠️  Resetting database - all data will be lost!');
    
    const executedMigrations = await this.getExecutedMigrations();
    
    // Rollback migrations in reverse order
    for (let i = executedMigrations.length - 1; i >= 0; i--) {
      const executedMigration = executedMigrations[i];
      const migration = this.migrations.find(m => m.version === executedMigration.version);
      
      if (migration) {
        console.log(`Rolling back migration ${migration.version}: ${migration.name}`);
        await migration.down();
        await this.removeMigrationRecord(migration.version);
      }
    }
    
    console.log('✅ Database reset completed');
  }
}

module.exports = new MigrationManager();