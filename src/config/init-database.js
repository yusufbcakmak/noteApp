const dbConnection = require('./database');
const migrationManager = require('./migrations');

/**
 * Database initialization utility
 * Creates all necessary tables and indexes using the migration system
 */
class DatabaseInitializer {
  constructor() {
    this.db = null;
  }

  /**
   * Initialize database with all tables and indexes using migrations
   */
  async initialize() {
    try {
      // Connect to database
      this.db = dbConnection.connect();
      
      console.log('Starting database initialization...');
      
      // Initialize migration system and run migrations
      await migrationManager.initialize();
      await migrationManager.migrate();
      
      console.log('Database initialization completed successfully');
      
      return true;
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Legacy method - kept for backward compatibility
   * Use migration system instead
   */
  async initializeLegacy() {
    try {
      // Connect to database
      this.db = dbConnection.connect();
      
      console.log('Starting legacy database initialization...');
      
      // Create tables in correct order (respecting foreign key dependencies)
      await this.createUsersTable();
      await this.createGroupsTable();
      await this.createNotesTable();
      await this.createCompletedNotesTable();
      
      // Create indexes for performance
      await this.createIndexes();
      
      console.log('Legacy database initialization completed successfully');
      
      return true;
    } catch (error) {
      console.error('Legacy database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create users table
   */
  async createUsersTable() {
    const createUsersSQL = `
      CREATE TABLE IF NOT EXISTS users (
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
    
    this.db.exec(createUsersSQL);
    console.log('✓ Users table created');
  }

  /**
   * Create groups table
   */
  async createGroupsTable() {
    const createGroupsSQL = `
      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT DEFAULT '#3498db',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `;
    
    this.db.exec(createGroupsSQL);
    console.log('✓ Groups table created');
  }

  /**
   * Create notes table
   */
  async createNotesTable() {
    const createNotesSQL = `
      CREATE TABLE IF NOT EXISTS notes (
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
    `;
    
    this.db.exec(createNotesSQL);
    console.log('✓ Notes table created');
  }

  /**
   * Create completed_notes table for history tracking
   */
  async createCompletedNotesTable() {
    const createCompletedNotesSQL = `
      CREATE TABLE IF NOT EXISTS completed_notes (
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
      )
    `;
    
    this.db.exec(createCompletedNotesSQL);
    console.log('✓ Completed notes table created');
  }

  /**
   * Create indexes for performance optimization
   */
  async createIndexes() {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_notes_status ON notes(status)',
      'CREATE INDEX IF NOT EXISTS idx_notes_priority ON notes(priority)',
      'CREATE INDEX IF NOT EXISTS idx_notes_group_id ON notes(group_id)',
      'CREATE INDEX IF NOT EXISTS idx_groups_user_id ON groups(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_completed_notes_user_id ON completed_notes(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_completed_notes_completed_at ON completed_notes(completed_at)',
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active)'
    ];

    for (const indexSQL of indexes) {
      this.db.exec(indexSQL);
    }
    
    console.log('✓ Database indexes created');
  }

  /**
   * Check if database tables exist
   */
  async checkTablesExist() {
    const tables = ['users', 'groups', 'notes', 'completed_notes'];
    const existingTables = [];
    
    for (const table of tables) {
      const result = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
      `).get(table);
      
      if (result) {
        existingTables.push(table);
      }
    }
    
    return {
      allExist: existingTables.length === tables.length,
      existing: existingTables,
      missing: tables.filter(t => !existingTables.includes(t))
    };
  }

  /**
   * Get database schema information
   */
  async getSchemaInfo() {
    const tables = this.db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all();

    const indexes = this.db.prepare(`
      SELECT name, tbl_name FROM sqlite_master 
      WHERE type='index' AND name NOT LIKE 'sqlite_%'
      ORDER BY tbl_name, name
    `).all();

    return {
      tables: tables.map(t => t.name),
      indexes: indexes
    };
  }

  /**
   * Reset database (drop all tables)
   * WARNING: This will delete all data
   */
  async resetDatabase() {
    console.log('WARNING: Resetting database - all data will be lost');
    
    const tables = ['completed_notes', 'notes', 'groups', 'users'];
    
    for (const table of tables) {
      this.db.exec(`DROP TABLE IF EXISTS ${table}`);
    }
    
    console.log('✓ All tables dropped');
    
    // Recreate tables
    await this.initialize();
  }
}

module.exports = new DatabaseInitializer();