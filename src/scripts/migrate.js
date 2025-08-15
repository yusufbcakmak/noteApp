#!/usr/bin/env node

/**
 * Database migration script
 * Usage:
 *   node src/scripts/migrate.js          - Run all pending migrations
 *   node src/scripts/migrate.js status   - Show migration status
 *   node src/scripts/migrate.js rollback - Rollback last migration
 *   node src/scripts/migrate.js reset    - Reset database (rollback all)
 */

const dbConnection = require('../config/database');
const migrationManager = require('../config/migrations');

async function main() {
  const command = process.argv[2] || 'migrate';
  
  try {
    // Connect to database
    dbConnection.connect();
    
    // Initialize migration system
    await migrationManager.initialize();
    
    switch (command) {
      case 'migrate':
      case 'up':
        await runMigrations();
        break;
        
      case 'status':
        await showStatus();
        break;
        
      case 'rollback':
      case 'down':
        await rollbackMigration();
        break;
        
      case 'reset':
        await resetDatabase();
        break;
        
      default:
        console.log('Unknown command:', command);
        showUsage();
        process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    dbConnection.close();
  }
}

async function runMigrations() {
  console.log('🚀 Running database migrations...\n');
  
  const migrationsRun = await migrationManager.migrate();
  
  if (migrationsRun > 0) {
    console.log(`\n🎉 ${migrationsRun} migrations completed successfully!`);
  } else {
    console.log('\n✅ Database is already up to date!');
  }
  
  await showStatus();
}

async function showStatus() {
  console.log('\n📊 Migration Status:');
  console.log('==================');
  
  const status = await migrationManager.getStatus();
  
  console.log(`Total migrations: ${status.total}`);
  console.log(`Executed: ${status.executed}`);
  console.log(`Pending: ${status.pending}`);
  
  console.log('\nMigration Details:');
  console.log('------------------');
  
  status.migrations.forEach(migration => {
    const statusIcon = migration.executed ? '✅' : '⏳';
    const executedInfo = migration.executed 
      ? ` (executed: ${migration.executedAt})`
      : ' (pending)';
    
    console.log(`${statusIcon} ${migration.version}: ${migration.name}${executedInfo}`);
  });
}

async function rollbackMigration() {
  console.log('🔄 Rolling back last migration...\n');
  
  const success = await migrationManager.rollback();
  
  if (success) {
    console.log('\n🎉 Rollback completed successfully!');
  } else {
    console.log('\n✅ No migrations to rollback!');
  }
  
  await showStatus();
}

async function resetDatabase() {
  console.log('⚠️  WARNING: This will reset the entire database!');
  console.log('All data will be permanently lost.');
  
  // In a real application, you might want to add a confirmation prompt here
  console.log('\n🔄 Resetting database...\n');
  
  await migrationManager.reset();
  
  console.log('\n🎉 Database reset completed!');
  await showStatus();
}

function showUsage() {
  console.log('\nUsage:');
  console.log('  node src/scripts/migrate.js [command]');
  console.log('\nCommands:');
  console.log('  migrate, up    Run all pending migrations (default)');
  console.log('  status         Show migration status');
  console.log('  rollback, down Rollback last migration');
  console.log('  reset          Reset database (rollback all migrations)');
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = main;