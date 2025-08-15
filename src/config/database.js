const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class DatabaseConnection {
  constructor() {
    this.db = null;
    // Use test database path if provided, otherwise use default
    this.dbPath = process.env.TEST_DB_PATH || path.join(process.cwd(), 'database', 'notes.db');
  }

  /**
   * Initialize database connection with WAL mode for better performance
   */
  connect() {
    try {
      // Ensure database directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Create database connection
      this.db = new Database(this.dbPath);
      
      // Enable WAL mode for better performance and concurrency
      this.db.pragma('journal_mode = WAL');
      
      // Enable foreign key constraints
      this.db.pragma('foreign_keys = ON');
      
      // Set synchronous mode to NORMAL for better performance
      this.db.pragma('synchronous = NORMAL');
      
      // Set cache size (negative value means KB, positive means pages)
      this.db.pragma('cache_size = -64000'); // 64MB cache
      
      console.log('Database connected successfully');
      console.log(`Database path: ${this.dbPath}`);
      console.log(`WAL mode enabled: ${this.db.pragma('journal_mode', { simple: true })}`);
      
      return this.db;
    } catch (error) {
      console.error('Failed to connect to database:', error);
      throw error;
    }
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