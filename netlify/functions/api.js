const serverless = require('serverless-http');
const { app, initializeRoutes } = require('../../src/app');
const config = require('../../src/config/environment');
const logger = require('../../src/utils/logger');
const dbConnection = require('../../src/config/database');

// Initialize database and routes once
let initialized = false;

async function initialize() {
  if (initialized) return;
  
  try {
    // Override database path for Netlify
    process.env.DATABASE_PATH = '/tmp/notes.db';
    
    // Connect to database
    dbConnection.connect();
    
    // Initialize routes
    initializeRoutes();
    
    initialized = true;
    console.log('Netlify function initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Netlify function:', error);
    throw error;
  }
}

// Create serverless handler
const handler = serverless(app, {
  binary: ['image/*', 'application/pdf', 'application/octet-stream']
});

// Export Netlify function
exports.handler = async (event, context) => {
  // Ensure initialization
  await initialize();
  
  // Handle the request
  return await handler(event, context);
};
