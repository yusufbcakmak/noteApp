#!/usr/bin/env node

/**
 * Database initialization script
 * Run this script to initialize the database with all tables and indexes
 */

const dbInitializer = require('../config/init-database');
const dbConnection = require('../config/database');

async function main() {
  try {
    console.log('🚀 Starting database initialization...\n');
    
    // Initialize database
    await dbInitializer.initialize();
    
    // Get schema information
    const schemaInfo = await dbInitializer.getSchemaInfo();
    
    console.log('\n📊 Database Schema Information:');
    console.log('Tables:', schemaInfo.tables);
    console.log('Indexes:', schemaInfo.indexes.length);
    
    // Check if all tables exist
    const tableCheck = await dbInitializer.checkTablesExist();
    console.log('\n✅ Table Status:');
    console.log('All tables exist:', tableCheck.allExist);
    console.log('Existing tables:', tableCheck.existing);
    
    if (tableCheck.missing.length > 0) {
      console.log('Missing tables:', tableCheck.missing);
    }
    
    console.log('\n🎉 Database initialization completed successfully!');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    dbConnection.close();
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = main;