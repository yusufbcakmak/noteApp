const fs = require('fs');
const path = require('path');

// Netlify build script to setup database
async function setupNetlifyDatabase() {
  try {
    console.log('Setting up database for Netlify deployment...');
    
    // For Netlify, we don't need to pre-create database
    // Database will be initialized at runtime in serverless function
    // Just ensure the scripts exist
    
    const dbScriptPath = path.join(__dirname, '..', 'src', 'scripts', 'init-db.js');
    const migrateScriptPath = path.join(__dirname, '..', 'src', 'scripts', 'migrate.js');
    
    if (!fs.existsSync(dbScriptPath)) {
      console.warn('Database init script not found:', dbScriptPath);
    }
    
    if (!fs.existsSync(migrateScriptPath)) {
      console.warn('Database migration script not found:', migrateScriptPath);
    }
    
    console.log('Database setup completed for Netlify (runtime initialization)');
    
  } catch (error) {
    console.error('Failed to setup database for Netlify:', error);
    // Don't exit with error for build process
    console.log('Continuing with build...');
  }
}

// Run if called directly
if (require.main === module) {
  setupNetlifyDatabase();
}

module.exports = setupNetlifyDatabase;
