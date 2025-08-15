const fs = require('fs').promises;
const path = require('path');
const SwaggerConfig = require('../config/swagger');
const logger = require('./logger');

/**
 * TypeScript interface generator from OpenAPI schemas
 */
class TypeGenerator {
  constructor() {
    this.swaggerConfig = new SwaggerConfig();
    this.spec = null;
  }

  /**
   * Initialize the type generator
   */
  async init() {
    this.spec = this.swaggerConfig.getSpec();
    logger.info('TypeScript generator initialized');
  }

  /**
   * Generate TypeScript interfaces from OpenAPI schemas
   */
  async generateTypes(outputPath = 'types/api.ts') {
    if (!this.spec) {
      await this.init();
    }

    const interfaces = this.generateInterfacesFromSchemas();
    const enums = this.generateEnumsFromSchemas();
    const apiTypes = this.generateApiTypes();

    const content = this.buildTypeScriptFile(interfaces, enums, apiTypes);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    // Write TypeScript file
    await fs.writeFile(outputPath, content, 'utf8');
    logger.info(`TypeScript interfaces generated: ${outputPath}`);

    return outputPath;
  }

  /**
   * Generate interfaces from OpenAPI schemas
   */
  generateInterfacesFromSchemas() {
    const interfaces = [];
    const schemas = this.spec.components?.schemas || {};

    for (const [schemaName, schema] of Object.entries(schemas)) {
      if (schema.type === 'object') {
        const interfaceCode = this.generateInterface(schemaName, schema);
        interfaces.push(interfaceCode);
      }
    }

    return interfaces;
  }

  /**
   * Generate enums from OpenAPI schemas
   */
  generateEnumsFromSchemas() {
    const enums = [];
    const schemas = this.spec.components?.schemas || {};

    // Extract enums from schema properties
    for (const [schemaName, schema] of Object.entries(schemas)) {
      if (schema.type === 'object' && schema.properties) {
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          if (propSchema.enum) {
            const enumName = this.generateEnumName(schemaName, propName);
            const enumCode = this.generateEnum(enumName, propSchema.enum);
            enums.push(enumCode);
          }
        }
      }
    }

    return enums;
  }

  /**
   * Generate API-specific types (requests, responses, etc.)
   */
  generateApiTypes() {
    const types = [];

    // Generate API response wrapper types
    types.push(`
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: ApiError;
  timestamp?: string;
  requestId?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export interface PaginatedResponse<T = any> {
  success: boolean;
  data: {
    items: T[];
    pagination: PaginationInfo;
  };
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface QueryParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  search?: string;
}
`);

    return types;
  }

  /**
   * Generate TypeScript interface from OpenAPI schema
   */
  generateInterface(name, schema) {
    const properties = [];
    const requiredFields = schema.required || [];

    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const isRequired = requiredFields.includes(propName);
        const propType = this.getTypeScriptType(propSchema);
        const optional = isRequired ? '' : '?';
        const description = propSchema.description ? `  /** ${propSchema.description} */\n` : '';
        
        properties.push(`${description}  ${propName}${optional}: ${propType};`);
      }
    }

    const description = schema.description ? `/** ${schema.description} */\n` : '';
    
    return `${description}export interface ${name} {
${properties.join('\n')}
}`;
  }

  /**
   * Generate TypeScript enum
   */
  generateEnum(name, values) {
    const enumValues = values.map(value => {
      const key = value.toUpperCase().replace(/[^A-Z0-9]/g, '_');
      return `  ${key} = '${value}'`;
    }).join(',\n');

    return `export enum ${name} {
${enumValues}
}`;
  }

  /**
   * Generate enum name from schema and property name
   */
  generateEnumName(schemaName, propName) {
    const capitalizedProp = propName.charAt(0).toUpperCase() + propName.slice(1);
    return `${schemaName}${capitalizedProp}`;
  }

  /**
   * Convert OpenAPI type to TypeScript type
   */
  getTypeScriptType(schema) {
    if (schema.$ref) {
      // Handle schema references
      const refPath = schema.$ref.replace('#/components/schemas/', '');
      return refPath;
    }

    if (schema.enum) {
      // Handle enum types
      return schema.enum.map(v => `'${v}'`).join(' | ');
    }

    switch (schema.type) {
      case 'string':
        if (schema.format === 'date-time') {
          return 'string'; // Could be Date if preferred
        }
        if (schema.format === 'email') {
          return 'string';
        }
        if (schema.pattern) {
          return 'string';
        }
        return 'string';

      case 'number':
      case 'integer':
        return 'number';

      case 'boolean':
        return 'boolean';

      case 'array':
        if (schema.items) {
          const itemType = this.getTypeScriptType(schema.items);
          return `${itemType}[]`;
        }
        return 'any[]';

      case 'object':
        if (schema.properties) {
          // Inline object type
          const properties = [];
          const requiredFields = schema.required || [];
          
          for (const [propName, propSchema] of Object.entries(schema.properties)) {
            const isRequired = requiredFields.includes(propName);
            const propType = this.getTypeScriptType(propSchema);
            const optional = isRequired ? '' : '?';
            properties.push(`${propName}${optional}: ${propType}`);
          }
          
          return `{ ${properties.join('; ')} }`;
        }
        return 'Record<string, any>';

      default:
        return 'any';
    }
  }

  /**
   * Build complete TypeScript file content
   */
  buildTypeScriptFile(interfaces, enums, apiTypes) {
    const header = `/**
 * Auto-generated TypeScript interfaces from OpenAPI specification
 * Generated on: ${new Date().toISOString()}
 * 
 * DO NOT EDIT THIS FILE MANUALLY
 * This file is automatically generated from the OpenAPI specification.
 * To update these types, modify the OpenAPI spec and regenerate.
 */

`;

    const sections = [
      header,
      '// ============================================================================',
      '// ENUMS',
      '// ============================================================================',
      '',
      ...enums,
      '',
      '// ============================================================================',
      '// INTERFACES',
      '// ============================================================================',
      '',
      ...interfaces,
      '',
      '// ============================================================================',
      '// API TYPES',
      '// ============================================================================',
      '',
      ...apiTypes,
      '',
      '// ============================================================================',
      '// EXPORT ALL',
      '// ============================================================================',
      '',
      'export default {};'
    ];

    return sections.join('\n');
  }

  /**
   * Generate frontend API client types
   */
  async generateFrontendTypes(outputPath = 'frontend/src/types/api.ts') {
    const content = await this.generateTypes();
    
    // Add frontend-specific types
    const frontendTypes = `
// Frontend-specific types
export interface ApiClient {
  get<T = any>(url: string, params?: QueryParams): Promise<ApiResponse<T>>;
  post<T = any>(url: string, data?: any): Promise<ApiResponse<T>>;
  put<T = any>(url: string, data?: any): Promise<ApiResponse<T>>;
  patch<T = any>(url: string, data?: any): Promise<ApiResponse<T>>;
  delete<T = any>(url: string): Promise<ApiResponse<T>>;
}

export interface AuthTokens {
  token: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}
`;

    const fullContent = content + frontendTypes;
    
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    await fs.writeFile(outputPath, fullContent, 'utf8');
    logger.info(`Frontend TypeScript interfaces generated: ${outputPath}`);

    return outputPath;
  }

  /**
   * Validate generated types against actual API responses
   */
  async validateGeneratedTypes(sampleResponses = {}) {
    const validationResults = [];

    for (const [endpoint, response] of Object.entries(sampleResponses)) {
      try {
        // This would require runtime type checking library like io-ts or zod
        // For now, we'll do basic validation
        const isValid = this.validateResponseStructure(response);
        validationResults.push({
          endpoint,
          valid: isValid,
          issues: isValid ? [] : ['Structure validation failed']
        });
      } catch (error) {
        validationResults.push({
          endpoint,
          valid: false,
          issues: [error.message]
        });
      }
    }

    return validationResults;
  }

  /**
   * Basic response structure validation
   */
  validateResponseStructure(response) {
    // Check if response has expected API response structure
    if (typeof response !== 'object' || response === null) {
      return false;
    }

    // Check for required fields
    if (!('success' in response)) {
      return false;
    }

    if (typeof response.success !== 'boolean') {
      return false;
    }

    // If success is false, should have error field
    if (!response.success && !response.error) {
      return false;
    }

    // If success is true, should have data field (optional)
    // This is basic validation - more sophisticated validation would require schema
    return true;
  }
}

module.exports = TypeGenerator;