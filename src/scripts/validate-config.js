#!/usr/bin/env node

/**
 * Configuration validation script
 * Validates environment configuration without starting the server
 */

const path = require('path');
const fs = require('fs');

// Load environment variables from .env file if it exists
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  console.log('✓ Loaded environment variables from .env file');
}

try {
  // Import configuration (this will validate it)
  const config = require('../config/environment');
  
  console.log('✓ Environment configuration validation passed');
  console.log('\nConfiguration Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const sanitizedConfig = config.getSanitizedConfig();
  
  console.log(`Environment: ${sanitizedConfig.server.environment}`);
  console.log(`Port: ${sanitizedConfig.server.port}`);
  console.log(`Host: ${sanitizedConfig.server.host}`);
  console.log(`Database: ${sanitizedConfig.database.path}`);
  console.log(`Log Level: ${sanitizedConfig.logging.level}`);
  console.log(`JWT Expires: ${sanitizedConfig.jwt.expiresIn}`);
  console.log(`Rate Limit: ${sanitizedConfig.rateLimit.maxRequests} requests per ${sanitizedConfig.rateLimit.windowMs}ms`);
  
  if (sanitizedConfig.email.host) {
    console.log(`Email: ${sanitizedConfig.email.host}:${sanitizedConfig.email.port}`);
  } else {
    console.log('Email: Not configured (password reset disabled)');
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Additional checks
  const warnings = [];
  
  if (config.isDevelopment() && !config.get('jwt.secret')) {
    warnings.push('JWT_SECRET not set - using default (not secure for production)');
  }
  
  if (config.isProduction() && config.get('security.corsOrigin') === '*') {
    warnings.push('CORS_ORIGIN is set to "*" in production - consider restricting to specific origins');
  }
  
  if (config.get('logging.level') === 'debug' && config.isProduction()) {
    warnings.push('LOG_LEVEL is set to "debug" in production - consider using "info" or "warn"');
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach(warning => console.log(`   ${warning}`));
  }
  
  console.log('\n✅ Configuration validation completed successfully');
  process.exit(0);
  
} catch (error) {
  console.error('❌ Configuration validation failed:');
  console.error(error.message);
  
  if (error.message.includes('JWT_SECRET')) {
    console.error('\n💡 Tip: Copy .env.example to .env and update the values');
  }
  
  process.exit(1);
}