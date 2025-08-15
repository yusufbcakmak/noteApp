const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class DatabaseConnection {
  constructor() {
    this.db = null;
    // Use test database path if provided, otherwise use default
    // For Netlify, use /tmp directory which is writable
    if (process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      this.dbPath = process.env.DATABASE_PATH || '/tmp/notes.db';
    } else {
      this.dbPath = process.env.TEST_DB_PATH || path.join(process.cwd(), 'database', 'notes.db');
    }
  }

  /**
   * Initialize database connection with WAL mode for better performance
   */
  connect() {
    try {
      // For Netlify/serverless, we need to initialize database on each request
      if (process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME) {
        this.initializeServerlessDatabase();
      }
      
      // Ensure database directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Create database connection
      this.db = new Database(this.dbPath);
      
      // Enable WAL mode for better performance and concurrency (not for serverless)
      if (!(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME)) {
        this.db.pragma('journal_mode = WAL');
      }
      
      // Enable foreign key constraints
      this.db.pragma('foreign_keys = ON');
      
      // Set synchronous mode to NORMAL for better performance
      this.db.pragma('synchronous = NORMAL');
      
      // Set cache size (negative value means KB, positive means pages)
      this.db.pragma('cache_size = -64000'); // 64MB cache
      
      console.log('Database connected successfully');
      console.log(`Database path: ${this.dbPath}`);
      
      return this.db;
    } catch (error) {
      console.error('Failed to connect to database:', error);
      throw error;
    }
  }

  /**
   * Initialize database for serverless environment
   */
  initializeServerlessDatabase() {
    try {
      // Check if database exists, if not create it with schema
      if (!fs.existsSync(this.dbPath)) {
        console.log('Initializing database for serverless environment...');
        
        // Create a temporary database connection to initialize schema
        const tempDb = new Database(this.dbPath);
        
        // Initialize basic schema
        this.initializeSchema(tempDb);
        
        tempDb.close();
        console.log('Serverless database initialized');
      }
    } catch (error) {
      console.error('Failed to initialize serverless database:', error);
      // Continue anyway, the connection might still work
    }
  }

  /**
   * Initialize basic database schema
   */
  initializeSchema(db) {
    // Users table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1,
        email_verified BOOLEAN DEFAULT 0,
        last_login DATETIME,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until DATETIME
      )
    `);

    // Groups table
    db.exec(`
      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        name TEXT NOT NULL,
        description TEXT,
        color TEXT DEFAULT '#3B82F6',
        user_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Notes table
    db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        title TEXT NOT NULL,
        content TEXT,
        status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed')),
        priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
        due_date DATETIME,
        group_id TEXT,
        user_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        tags TEXT,
        reminder_date DATETIME,
        estimated_time INTEGER,
        actual_time INTEGER,
        FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Completed notes table
    db.exec(`
      CREATE TABLE IF NOT EXISTS completed_notes (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        original_note_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        priority TEXT DEFAULT 'medium',
        due_date DATETIME,
        group_id TEXT,
        user_id TEXT NOT NULL,
        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        original_created_at DATETIME,
        tags TEXT,
        estimated_time INTEGER,
        actual_time INTEGER,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    console.log('Database schema initialized');
  }

  /**
   * Get the database instance
   */
  getDatabase() {
    if (!this.db) {
      throw new Error('Database not initialized. Call connect() first.');
    }
    return this.db;
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('Database connection closed');
    }
  }

  /**
   * Check if database is connected
   */
  isConnected() {
    return this.db !== null && this.db.open;
  }

  /**
   * Execute a query with error handling
   */
  executeQuery(query, params = []) {
    try {
      const stmt = this.db.prepare(query);
      return stmt.run(params);
    } catch (error) {
      console.error('Query execution failed:', error);
      throw error;
    }
  }

  /**
   * Get query results
   */
  getQuery(query, params = []) {
    try {
      const stmt = this.db.prepare(query);
      return stmt.get(params);
    } catch (error) {
      console.error('Query execution failed:', error);
      throw error;
    }
  }

  /**
   * Get all query results
   */
  getAllQuery(query, params = []) {
    try {
      const stmt = this.db.prepare(query);
      return stmt.all(params);
    } catch (error) {
      console.error('Query execution failed:', error);
      throw error;
    }
  }

  /**
   * Begin transaction
   */
  beginTransaction() {
    return this.db.transaction(() => {});
  }

  /**
   * Execute multiple statements in a transaction
   */
  executeTransaction(statements) {
    const transaction = this.db.transaction(() => {
      for (const { query, params } of statements) {
        const stmt = this.db.prepare(query);
        stmt.run(params || []);
      }
    });
    
    return transaction();
  }
}

// Create singleton instance
const dbConnection = new DatabaseConnection();

module.exports = dbConnection;