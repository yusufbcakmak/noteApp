#!/usr/bin/env node

/**
 * CLI script to generate API contracts and TypeScript interfaces
 */

const path = require('path');
const fs = require('fs').promises;
const TypeGenerator = require('../utils/typeGenerator');
const ContractTesting = require('../utils/contractTesting');
const SwaggerConfig = require('../config/swagger');
const logger = require('../utils/logger');

/**
 * CLI command handler
 */
class ContractGenerator {
  constructor() {
    this.typeGenerator = new TypeGenerator();
    this.contractTesting = new ContractTesting();
    this.swaggerConfig = new SwaggerConfig();
  }

  /**
   * Generate TypeScript interfaces
   */
  async generateTypes(options = {}) {
    try {
      logger.info('Generating TypeScript interfaces...');
      
      const backendPath = options.backend || 'types/api.ts';
      const frontendPath = options.frontend || 'frontend/src/types/api.ts';

      // Generate backend types
      await this.typeGenerator.generateTypes(backendPath);
      logger.info(`Backend types generated: ${backendPath}`);

      // Generate frontend types
      await this.typeGenerator.generateFrontendTypes(frontendPath);
      logger.info(`Frontend types generated: ${frontendPath}`);

      return { backendPath, frontendPath };
    } catch (error) {
      logger.error('Failed to generate TypeScript interfaces:', error);
      throw error;
    }
  }

  /**
   * Generate contract tests
   */
  async generateContractTests(options = {}) {
    try {
      logger.info('Generating contract tests...');
      
      const outputPath = options.output || 'tests/contract';
      const testSuites = await this.contractTesting.generateContractTests(outputPath);
      
      logger.info(`Contract tests generated: ${outputPath}`);
      logger.info(`Generated ${testSuites.length} test suites`);

      return { outputPath, testSuites };
    } catch (error) {
      logger.error('Failed to generate contract tests:', error);
      throw error;
    }
  }

  /**
   * Validate OpenAPI specification
   */
  async validateSpec() {
    try {
      logger.info('Validating OpenAPI specification...');
      
      const spec = this.swaggerConfig.getSpec();
      
      // Basic validation
      if (!spec.openapi) {
        throw new Error('Missing OpenAPI version');
      }

      if (!spec.info || !spec.info.title || !spec.info.version) {
        throw new Error('Missing required info fields');
      }

      if (!spec.paths || Object.keys(spec.paths).length === 0) {
        throw new Error('No API paths defined');
      }

      const pathCount = Object.keys(spec.paths).length;
      const schemaCount = Object.keys(spec.components?.schemas || {}).length;

      logger.info(`OpenAPI specification is valid`);
      logger.info(`- Paths: ${pathCount}`);
      logger.info(`- Schemas: ${schemaCount}`);
      logger.info(`- Version: ${spec.info.version}`);

      return {
        valid: true,
        pathCount,
        schemaCount,
        version: spec.info.version
      };
    } catch (error) {
      logger.error('OpenAPI specification validation failed:', error);
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Export OpenAPI specification to file
   */
  async exportSpec(options = {}) {
    try {
      const outputPath = options.output || 'openapi.json';
      const format = options.format || 'json';
      
      const spec = this.swaggerConfig.getSpec();
      
      let content;
      if (format === 'yaml') {
        const yaml = require('js-yaml');
        content = yaml.dump(spec, { indent: 2 });
      } else {
        content = JSON.stringify(spec, null, 2);
      }

      await fs.writeFile(outputPath, content, 'utf8');
      logger.info(`OpenAPI specification exported: ${outputPath}`);

      return { outputPath, format };
    } catch (error) {
      logger.error('Failed to export OpenAPI specification:', error);
      throw error;
    }
  }

  /**
   * Generate all contracts and documentation
   */
  async generateAll(options = {}) {
    try {
      logger.info('Generating all API contracts and documentation...');

      // Validate specification first
      const validation = await this.validateSpec();
      if (!validation.valid) {
        throw new Error(`Invalid OpenAPI specification: ${validation.error}`);
      }

      // Generate TypeScript interfaces
      const types = await this.generateTypes(options);

      // Generate contract tests
      const tests = await this.generateContractTests(options);

      // Export OpenAPI spec
      const spec = await this.exportSpec(options);

      logger.info('All contracts generated successfully!');

      return {
        validation,
        types,
        tests,
        spec
      };
    } catch (error) {
      logger.error('Failed to generate contracts:', error);
      throw error;
    }
  }

  /**
   * Watch for changes and regenerate
   */
  async watch(options = {}) {
    logger.info('Watching for changes...');
    
    const watchPaths = [
      'src/routes',
      'src/controllers',
      'src/validation',
      'src/config/swagger.js'
    ];

    // Simple file watching implementation
    const chokidar = require('chokidar');
    const watcher = chokidar.watch(watchPaths, {
      ignored: /node_modules/,
      persistent: true
    });

    let timeout;
    watcher.on('change', (filePath) => {
      logger.info(`File changed: ${filePath}`);
      
      // Debounce regeneration
      clearTimeout(timeout);
      timeout = setTimeout(async () => {
        try {
          await this.generateAll(options);
          logger.info('Contracts regenerated due to file changes');
        } catch (error) {
          logger.error('Failed to regenerate contracts:', error);
        }
      }, 1000);
    });

    logger.info('Watching for changes. Press Ctrl+C to stop.');
    
    // Keep process alive
    process.on('SIGINT', () => {
      logger.info('Stopping file watcher...');
      watcher.close();
      process.exit(0);
    });
  }
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const generator = new ContractGenerator();

  try {
    switch (command) {
      case 'types':
        await generator.generateTypes();
        break;
        
      case 'tests':
        await generator.generateContractTests();
        break;
        
      case 'validate':
        await generator.validateSpec();
        break;
        
      case 'export':
        await generator.exportSpec();
        break;
        
      case 'watch':
        await generator.watch();
        break;
        
      case 'all':
      default:
        await generator.generateAll();
        break;
    }
  } catch (error) {
    logger.error('Command failed:', error);
    process.exit(1);
  }
}

// Run CLI if called directly
if (require.main === module) {
  main();
}

module.exports = ContractGenerator;