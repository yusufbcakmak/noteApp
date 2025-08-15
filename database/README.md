# Database Documentation

This document describes the database setup, schema, and migration system for the Note Management Application.

## Overview

The application uses SQLite with better-sqlite3 for data persistence. The database is configured with:
- WAL (Write-Ahead Logging) mode for better performance and concurrency
- Foreign key constraints enabled
- Optimized cache settings
- Performance indexes

## Database Schema

### Tables

#### users
Stores user account information.

```sql
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
);
```

#### groups
Stores user-defined groups for organizing notes.

```sql
CREATE TABLE groups (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3498db',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### notes
Stores user notes with status and priority information.

```sql
CREATE TABLE notes (
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
);
```

#### completed_notes
Stores historical data of completed notes for analytics.

```sql
CREATE TABLE completed_notes (
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
);
```

### Indexes

Performance indexes are created for frequently queried columns:

- `idx_notes_user_id` - Notes by user
- `idx_notes_status` - Notes by status
- `idx_notes_priority` - Notes by priority
- `idx_notes_group_id` - Notes by group
- `idx_notes_created_at` - Notes by creation date
- `idx_groups_user_id` - Groups by user
- `idx_completed_notes_user_id` - Completed notes by user
- `idx_completed_notes_completed_at` - Completed notes by completion date
- `idx_users_email` - Users by email (for login)
- `idx_users_is_active` - Active users
- `idx_users_created_at` - Users by registration date

## Migration System

The application includes a comprehensive migration system for database schema versioning.

### Available Migrations

1. **Migration 001: initial_schema**
   - Creates all base tables (users, groups, notes, completed_notes)
   - Sets up foreign key relationships
   - Adds check constraints for status and priority

2. **Migration 002: add_indexes**
   - Creates performance indexes on frequently queried columns
   - Optimizes query performance for user-specific data

### Migration Commands

#### Using npm scripts (recommended):

```bash
# Initialize database (legacy method)
npm run db:init

# Run all pending migrations
npm run db:migrate

# Check migration status
npm run db:migrate:status

# Rollback last migration
npm run db:migrate:rollback

# Reset database (rollback all migrations)
npm run db:migrate:reset
```

#### Using node directly:

```bash
# Run migrations
node src/scripts/migrate.js

# Check status
node src/scripts/migrate.js status

# Rollback
node src/scripts/migrate.js rollback

# Reset
node src/scripts/migrate.js reset
```

### Migration Status Output

```
📊 Migration Status:
==================
Total migrations: 2
Executed: 2
Pending: 0

Migration Details:
------------------
✅ 001: initial_schema (executed: 2025-08-13 07:29:32)
✅ 002: add_indexes (executed: 2025-08-13 07:29:41)
```

## Database Connection

### Configuration

The database connection is configured with optimal settings:

```javascript
// WAL mode for better performance
db.pragma('journal_mode = WAL');

// Enable foreign key constraints
db.pragma('foreign_keys = ON');

// Optimize synchronous mode
db.pragma('synchronous = NORMAL');

// Set cache size to 64MB
db.pragma('cache_size = -64000');
```

### Connection Management

The database connection is managed through a singleton pattern:

```javascript
const dbConnection = require('./src/config/database');

// Connect to database
const db = dbConnection.connect();

// Get database instance
const db = dbConnection.getDatabase();

// Check connection status
const isConnected = dbConnection.isConnected();

// Close connection
dbConnection.close();
```

## Development Workflow

### Setting up a new environment

1. Install dependencies:
   ```bash
   npm install
   ```

2. Initialize database:
   ```bash
   npm run db:migrate
   ```

3. Check database status:
   ```bash
   npm run db:migrate:status
   ```

### Adding new migrations

1. Add migration to `src/config/migrations.js`:
   ```javascript
   {
     version: '003',
     name: 'add_new_feature',
     up: this.migration003Up.bind(this),
     down: this.migration003Down.bind(this)
   }
   ```

2. Implement up and down methods:
   ```javascript
   async migration003Up() {
     // Add new schema changes
   }
   
   async migration003Down() {
     // Rollback schema changes
   }
   ```

3. Run migration:
   ```bash
   npm run db:migrate
   ```

### Testing

Database tests are located in:
- `tests/database.test.js` - Database connection and basic operations
- `tests/migrations.test.js` - Migration system tests

Run database tests:
```bash
npm test -- tests/database.test.js
npm test -- tests/migrations.test.js
```

## File Structure

```
database/
├── README.md           # This documentation
└── notes.db           # SQLite database file (created automatically)

src/config/
├── database.js        # Database connection utility
├── init-database.js   # Database initialization (legacy)
└── migrations.js      # Migration system

src/scripts/
├── init-db.js        # Database initialization script
└── migrate.js        # Migration management script

tests/
├── database.test.js   # Database connection tests
└── migrations.test.js # Migration system tests
```

## Performance Considerations

1. **WAL Mode**: Enables concurrent reads while writing
2. **Indexes**: Optimized for common query patterns
3. **Cache Size**: 64MB cache for better performance
4. **Prepared Statements**: All queries use prepared statements
5. **Connection Pooling**: Single connection with proper lifecycle management

## Security Features

1. **Foreign Key Constraints**: Maintain data integrity
2. **Check Constraints**: Validate enum values (status, priority)
3. **Parameterized Queries**: Prevent SQL injection
4. **User Isolation**: All queries are user-scoped

## Backup and Recovery

### Manual Backup
```bash
# Create backup
cp database/notes.db database/backup-$(date +%Y%m%d-%H%M%S).db

# Restore from backup
cp database/backup-20250813-073000.db database/notes.db
```

### Migration-based Recovery
```bash
# Reset and rebuild database
npm run db:migrate:reset
npm run db:migrate
```

## Troubleshooting

### Common Issues

1. **Database locked**: Ensure no other processes are using the database
2. **Migration failed**: Check migration logs and rollback if needed
3. **Foreign key constraint**: Ensure referenced records exist
4. **Disk space**: SQLite requires free disk space for WAL operations

### Debug Commands

```bash
# Check database integrity
sqlite3 database/notes.db "PRAGMA integrity_check;"

# View database schema
sqlite3 database/notes.db ".schema"

# Check WAL mode
sqlite3 database/notes.db "PRAGMA journal_mode;"
```