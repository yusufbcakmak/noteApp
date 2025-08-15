const fs = require('fs').promises;
const path = require('path');
const SwaggerConfig = require('../config/swagger');
const logger = require('./logger');

/**
 * API consistency validator between frontend and backend
 */
class ApiConsistencyValidator {
  constructor() {
    this.swaggerConfig = new SwaggerConfig();
    this.spec = null;
    this.frontendApiCalls = new Map();
    this.backendEndpoints = new Map();
    this.inconsistencies = [];
  }

  /**
   * Initialize the validator
   */
  async init() {
    this.spec = this.swaggerConfig.getSpec();
    await this.extractBackendEndpoints();
    logger.info('API consistency validator initialized');
  }

  /**
   * Extract backend endpoints from OpenAPI spec
   */
  async extractBackendEndpoints() {
    if (!this.spec || !this.spec.paths) {
      throw new Error('OpenAPI specification not loaded');
    }

    for (const [pathPattern, pathItem] of Object.entries(this.spec.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (typeof operation === 'object' && method !== 'parameters') {
          const endpoint = {
            path: pathPattern,
            method: method.toUpperCase(),
            operationId: operation.operationId || `${method}_${pathPattern.replace(/[^a-zA-Z0-9]/g, '_')}`,
            parameters: operation.parameters || [],
            requestBody: operation.requestBody,
            responses: operation.responses,
            tags: operation.tags || []
          };

          const key = `${method.toUpperCase()} ${pathPattern}`;
          this.backendEndpoints.set(key, endpoint);
        }
      }
    }

    logger.info(`Extracted ${this.backendEndpoints.size} backend endpoints`);
  }

  /**
   * Scan frontend code for API calls
   */
  async scanFrontendApiCalls(frontendPath = 'frontend/src') {
    try {
      await this.scanDirectory(frontendPath);
      logger.info(`Found ${this.frontendApiCalls.size} frontend API calls`);
    } catch (error) {
      logger.error('Failed to scan frontend API calls:', error);
      throw error;
    }
  }

  /**
   * Recursively scan directory for API calls
   */
  async scanDirectory(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules and other irrelevant directories
          if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
            await this.scanDirectory(fullPath);
          }
        } else if (this.isRelevantFile(entry.name)) {
          await this.scanFile(fullPath);
        }
      }
    } catch (error) {
      // Directory might not exist, which is fine
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Check if file is relevant for API call scanning
   */
  isRelevantFile(filename) {
    const extensions = ['.js', '.jsx', '.ts', '.tsx'];
    return extensions.some(ext => filename.endsWith(ext));
  }

  /**
   * Scan individual file for API calls
   */
  async scanFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const apiCalls = this.extractApiCalls(content, filePath);

      for (const apiCall of apiCalls) {
        const key = `${apiCall.method} ${apiCall.path}`;
        if (!this.frontendApiCalls.has(key)) {
          this.frontendApiCalls.set(key, []);
        }
        this.frontendApiCalls.get(key).push(apiCall);
      }
    } catch (error) {
      logger.warn(`Failed to scan file ${filePath}:`, error.message);
    }
  }

  /**
   * Extract API calls from file content
   */
  extractApiCalls(content, filePath) {
    const apiCalls = [];
    
    // Patterns to match API calls
    const patterns = [
      // fetch calls: fetch('/api/notes', { method: 'POST' })
      /fetch\s*\(\s*['"`]([^'"`]+)['"`]\s*,?\s*\{[^}]*method\s*:\s*['"`]([^'"`]+)['"`]/gi,
      // fetch calls: await fetch('/api/notes')
      /await\s+fetch\s*\(\s*['"`]([^'"`]+)['"`]/gi,
      // axios calls: axios.post('/api/notes')
      /axios\.(\w+)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
      // axios calls with generics: axios.post<User>('/api/notes')
      /axios\.(\w+)\s*<[^>]*>\s*\(\s*['"`]([^'"`]+)['"`]/gi,
      // api client calls: api.get('/api/notes')
      /(?:api|client)\.(\w+)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
      // request calls: request({ url: '/api/notes', method: 'GET' })
      /request\s*\(\s*\{[^}]*url\s*:\s*['"`]([^'"`]+)['"`][^}]*method\s*:\s*['"`]([^'"`]+)['"`]/gi
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        let method, url;
        
        if (pattern.source.includes('fetch') && pattern.source.includes('method')) {
          [, url, method] = match;
        } else if (pattern.source.includes('await') && pattern.source.includes('fetch')) {
          [, url] = match;
          method = 'GET'; // Default method for simple fetch calls
        } else if (pattern.source.includes('request')) {
          [, url, method] = match;
        } else if (pattern.source.includes('<[^>]*>')) {
          [, method, url] = match;
        } else {
          [, method, url] = match;
        }

        // Only include API calls (starting with /api)
        if (url && url.startsWith('/api')) {
          apiCalls.push({
            method: method.toUpperCase(),
            path: url,
            file: filePath,
            line: this.getLineNumber(content, match.index)
          });
        }
      }
    }

    return apiCalls;
  }

  /**
   * Get line number for a given character index
   */
  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * Validate consistency between frontend and backend
   */
  async validateConsistency() {
    this.inconsistencies = [];

    // Check for frontend calls without backend endpoints
    for (const [key, calls] of this.frontendApiCalls) {
      if (!this.backendEndpoints.has(key)) {
        // Try to find similar endpoints (with path parameters)
        const similarEndpoint = this.findSimilarEndpoint(key);
        
        if (!similarEndpoint) {
          this.inconsistencies.push({
            type: 'missing_backend_endpoint',
            severity: 'error',
            message: `Frontend calls ${key} but no backend endpoint exists`,
            frontendCalls: calls,
            suggestions: this.suggestSimilarEndpoints(key)
          });
        }
      }
    }

    // Check for backend endpoints not used by frontend
    for (const [key, endpoint] of this.backendEndpoints) {
      if (!this.frontendApiCalls.has(key) && !this.isInternalEndpoint(endpoint)) {
        // Try to find similar frontend calls
        const similarCall = this.findSimilarFrontendCall(key);
        
        if (!similarCall) {
          this.inconsistencies.push({
            type: 'unused_backend_endpoint',
            severity: 'warning',
            message: `Backend endpoint ${key} is not used by frontend`,
            endpoint: endpoint,
            suggestions: this.suggestSimilarFrontendCalls(key)
          });
        }
      }
    }

    // Validate request/response schemas
    await this.validateSchemas();

    logger.info(`Found ${this.inconsistencies.length} API consistency issues`);
    return this.inconsistencies;
  }

  /**
   * Find similar endpoint with path parameters
   */
  findSimilarEndpoint(frontendKey) {
    const [method, path] = frontendKey.split(' ');
    
    for (const [backendKey, endpoint] of this.backendEndpoints) {
      const [backendMethod, backendPath] = backendKey.split(' ');
      
      if (method === backendMethod && this.pathsMatch(path, backendPath)) {
        return endpoint;
      }
    }
    
    return null;
  }

  /**
   * Check if paths match (considering path parameters)
   */
  pathsMatch(frontendPath, backendPath) {
    // Convert backend path parameters {id} to regex pattern
    const backendPattern = backendPath.replace(/\{[^}]+\}/g, '[^/]+');
    const regex = new RegExp(`^${backendPattern}$`);
    return regex.test(frontendPath);
  }

  /**
   * Find similar frontend call
   */
  findSimilarFrontendCall(backendKey) {
    const [method, path] = backendKey.split(' ');
    
    for (const [frontendKey, calls] of this.frontendApiCalls) {
      const [frontendMethod, frontendPath] = frontendKey.split(' ');
      
      if (method === frontendMethod && this.pathsMatch(frontendPath, path)) {
        return calls[0];
      }
    }
    
    return null;
  }

  /**
   * Check if endpoint is internal (not meant for frontend)
   */
  isInternalEndpoint(endpoint) {
    const internalPaths = ['/health', '/api-docs', '/api/openapi.json', '/api/contract/validate'];
    return internalPaths.some(internalPath => endpoint.path.startsWith(internalPath));
  }

  /**
   * Suggest similar endpoints
   */
  suggestSimilarEndpoints(frontendKey) {
    const [method, path] = frontendKey.split(' ');
    const suggestions = [];

    for (const [backendKey, endpoint] of this.backendEndpoints) {
      const [backendMethod, backendPath] = backendKey.split(' ');
      
      // Same method, similar path
      if (method === backendMethod && this.calculatePathSimilarity(path, backendPath) > 0.5) {
        suggestions.push({
          endpoint: backendKey,
          similarity: this.calculatePathSimilarity(path, backendPath)
        });
      }
    }

    return suggestions.sort((a, b) => b.similarity - a.similarity).slice(0, 3);
  }

  /**
   * Suggest similar frontend calls
   */
  suggestSimilarFrontendCalls(backendKey) {
    const [method, path] = backendKey.split(' ');
    const suggestions = [];

    for (const [frontendKey, calls] of this.frontendApiCalls) {
      const [frontendMethod, frontendPath] = frontendKey.split(' ');
      
      // Same method, similar path
      if (method === frontendMethod && this.calculatePathSimilarity(path, frontendPath) > 0.5) {
        suggestions.push({
          call: frontendKey,
          similarity: this.calculatePathSimilarity(path, frontendPath),
          files: calls.map(c => c.file)
        });
      }
    }

    return suggestions.sort((a, b) => b.similarity - a.similarity).slice(0, 3);
  }

  /**
   * Calculate path similarity (simple Levenshtein-based)
   */
  calculatePathSimilarity(path1, path2) {
    const maxLength = Math.max(path1.length, path2.length);
    if (maxLength === 0) return 1;
    
    const distance = this.levenshteinDistance(path1, path2);
    return (maxLength - distance) / maxLength;
  }

  /**
   * Calculate Levenshtein distance
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Validate request/response schemas
   */
  async validateSchemas() {
    // This would require more sophisticated analysis
    // For now, we'll add basic validation
    
    for (const [key, calls] of this.frontendApiCalls) {
      const endpoint = this.backendEndpoints.get(key) || this.findSimilarEndpoint(key);
      
      if (endpoint) {
        // Check if frontend is sending data that matches request schema
        // Check if frontend is expecting data that matches response schema
        // This would require parsing the actual frontend code more deeply
        
        const schemaIssues = await this.validateEndpointSchemas(endpoint, calls);
        this.inconsistencies.push(...schemaIssues);
      }
    }
  }

  /**
   * Validate schemas for specific endpoint
   */
  async validateEndpointSchemas(endpoint, frontendCalls) {
    const issues = [];
    
    // This is a placeholder for more sophisticated schema validation
    // In a real implementation, this would:
    // 1. Parse frontend code to extract request/response handling
    // 2. Compare with OpenAPI schemas
    // 3. Report type mismatches
    
    return issues;
  }

  /**
   * Generate consistency report
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalFrontendCalls: this.frontendApiCalls.size,
        totalBackendEndpoints: this.backendEndpoints.size,
        totalInconsistencies: this.inconsistencies.length,
        errorCount: this.inconsistencies.filter(i => i.severity === 'error').length,
        warningCount: this.inconsistencies.filter(i => i.severity === 'warning').length
      },
      inconsistencies: this.inconsistencies,
      frontendApiCalls: Array.from(this.frontendApiCalls.entries()).map(([key, calls]) => ({
        endpoint: key,
        callCount: calls.length,
        files: [...new Set(calls.map(c => c.file))]
      })),
      backendEndpoints: Array.from(this.backendEndpoints.entries()).map(([key, endpoint]) => ({
        endpoint: key,
        operationId: endpoint.operationId,
        tags: endpoint.tags
      }))
    };

    return report;
  }

  /**
   * Save report to file
   */
  async saveReport(outputPath = 'api-consistency-report.json') {
    const report = this.generateReport();
    await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf8');
    logger.info(`API consistency report saved: ${outputPath}`);
    return outputPath;
  }

  /**
   * Generate human-readable report
   */
  generateHumanReadableReport() {
    const report = this.generateReport();
    let output = `# API Consistency Report\n\n`;
    output += `Generated: ${report.timestamp}\n\n`;
    
    output += `## Summary\n`;
    output += `- Frontend API calls: ${report.summary.totalFrontendCalls}\n`;
    output += `- Backend endpoints: ${report.summary.totalBackendEndpoints}\n`;
    output += `- Total issues: ${report.summary.totalInconsistencies}\n`;
    output += `- Errors: ${report.summary.errorCount}\n`;
    output += `- Warnings: ${report.summary.warningCount}\n\n`;

    if (report.inconsistencies.length > 0) {
      output += `## Issues\n\n`;
      
      for (const issue of report.inconsistencies) {
        output += `### ${issue.severity.toUpperCase()}: ${issue.type}\n`;
        output += `${issue.message}\n\n`;
        
        if (issue.frontendCalls) {
          output += `**Frontend calls:**\n`;
          for (const call of issue.frontendCalls) {
            output += `- ${call.file}:${call.line}\n`;
          }
          output += `\n`;
        }
        
        if (issue.suggestions && issue.suggestions.length > 0) {
          output += `**Suggestions:**\n`;
          for (const suggestion of issue.suggestions) {
            output += `- ${suggestion.endpoint || suggestion.call} (similarity: ${(suggestion.similarity * 100).toFixed(1)}%)\n`;
          }
          output += `\n`;
        }
      }
    } else {
      output += `## ✅ No consistency issues found!\n\n`;
    }

    return output;
  }

  /**
   * Save human-readable report
   */
  async saveHumanReadableReport(outputPath = 'api-consistency-report.md') {
    const report = this.generateHumanReadableReport();
    await fs.writeFile(outputPath, report, 'utf8');
    logger.info(`Human-readable API consistency report saved: ${outputPath}`);
    return outputPath;
  }
}

module.exports = ApiConsistencyValidator;