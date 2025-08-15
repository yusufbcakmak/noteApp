const fs = require('fs').promises;
const path = require('path');
const SwaggerConfig = require('../config/swagger');
const logger = require('./logger');

/**
 * API documentation generator with validation tools
 */
class ApiDocumentationGenerator {
  constructor() {
    this.swaggerConfig = new SwaggerConfig();
    this.spec = null;
  }

  /**
   * Initialize the documentation generator
   */
  async init() {
    this.spec = this.swaggerConfig.getSpec();
    logger.info('API documentation generator initialized');
  }

  /**
   * Generate comprehensive API documentation
   */
  async generateDocumentation(outputDir = 'docs/api') {
    if (!this.spec) {
      await this.init();
    }

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Generate different documentation formats
    const results = {
      markdown: await this.generateMarkdownDocs(outputDir),
      html: await this.generateHtmlDocs(outputDir),
      postman: await this.generatePostmanCollection(outputDir),
      insomnia: await this.generateInsomniaCollection(outputDir),
      readme: await this.generateReadme(outputDir)
    };

    logger.info(`API documentation generated in: ${outputDir}`);
    return results;
  }

  /**
   * Generate Markdown documentation
   */
  async generateMarkdownDocs(outputDir) {
    const markdownContent = this.buildMarkdownContent();
    const outputPath = path.join(outputDir, 'api-reference.md');
    await fs.writeFile(outputPath, markdownContent, 'utf8');
    return outputPath;
  }

  /**
   * Build Markdown content
   */
  buildMarkdownContent() {
    let content = `# ${this.spec.info.title}\n\n`;
    content += `${this.spec.info.description}\n\n`;
    content += `**Version:** ${this.spec.info.version}\n\n`;

    if (this.spec.servers && this.spec.servers.length > 0) {
      content += `## Servers\n\n`;
      for (const server of this.spec.servers) {
        content += `- **${server.description || 'Server'}:** \`${server.url}\`\n`;
      }
      content += `\n`;
    }

    // Authentication
    if (this.spec.components?.securitySchemes) {
      content += `## Authentication\n\n`;
      for (const [schemeName, scheme] of Object.entries(this.spec.components.securitySchemes)) {
        content += `### ${schemeName}\n\n`;
        content += `- **Type:** ${scheme.type}\n`;
        if (scheme.scheme) content += `- **Scheme:** ${scheme.scheme}\n`;
        if (scheme.bearerFormat) content += `- **Bearer Format:** ${scheme.bearerFormat}\n`;
        if (scheme.description) content += `- **Description:** ${scheme.description}\n`;
        content += `\n`;
      }
    }

    // Group endpoints by tags
    const endpointsByTag = this.groupEndpointsByTag();

    for (const [tag, endpoints] of Object.entries(endpointsByTag)) {
      content += `## ${tag}\n\n`;
      
      for (const endpoint of endpoints) {
        content += this.buildEndpointMarkdown(endpoint);
      }
    }

    // Data Models
    if (this.spec.components?.schemas) {
      content += `## Data Models\n\n`;
      for (const [schemaName, schema] of Object.entries(this.spec.components.schemas)) {
        content += this.buildSchemaMarkdown(schemaName, schema);
      }
    }

    return content;
  }

  /**
   * Group endpoints by tags
   */
  groupEndpointsByTag() {
    const grouped = {};

    for (const [pathPattern, pathItem] of Object.entries(this.spec.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (typeof operation === 'object' && method !== 'parameters') {
          const tags = operation.tags || ['General'];
          const tag = tags[0];

          if (!grouped[tag]) {
            grouped[tag] = [];
          }

          grouped[tag].push({
            path: pathPattern,
            method: method.toUpperCase(),
            operation
          });
        }
      }
    }

    return grouped;
  }

  /**
   * Build Markdown for single endpoint
   */
  buildEndpointMarkdown(endpoint) {
    const { path, method, operation } = endpoint;
    let content = `### ${method} ${path}\n\n`;

    if (operation.summary) {
      content += `${operation.summary}\n\n`;
    }

    if (operation.description) {
      content += `${operation.description}\n\n`;
    }

    // Parameters
    if (operation.parameters && operation.parameters.length > 0) {
      content += `#### Parameters\n\n`;
      content += `| Name | In | Type | Required | Description |\n`;
      content += `|------|----|----- |----------|-------------|\n`;

      for (const param of operation.parameters) {
        const type = param.schema?.type || 'string';
        const required = param.required ? 'Yes' : 'No';
        const description = param.description || '';
        content += `| ${param.name} | ${param.in} | ${type} | ${required} | ${description} |\n`;
      }
      content += `\n`;
    }

    // Request Body
    if (operation.requestBody) {
      content += `#### Request Body\n\n`;
      const mediaType = operation.requestBody.content['application/json'];
      if (mediaType && mediaType.schema) {
        content += `**Content Type:** \`application/json\`\n\n`;
        content += this.buildSchemaExample(mediaType.schema);
      }
    }

    // Responses
    if (operation.responses) {
      content += `#### Responses\n\n`;
      for (const [statusCode, response] of Object.entries(operation.responses)) {
        content += `**${statusCode}** - ${response.description || 'Response'}\n\n`;
        
        if (response.content && response.content['application/json']) {
          const schema = response.content['application/json'].schema;
          if (schema) {
            content += this.buildSchemaExample(schema);
          }
        }
      }
    }

    // Example
    content += `#### Example\n\n`;
    content += `\`\`\`bash\n`;
    content += `curl -X ${method} \\\n`;
    content += `  "${this.spec.servers?.[0]?.url || 'http://localhost:3000'}${path}" \\\n`;
    
    if (operation.security || this.spec.security) {
      content += `  -H "Authorization: Bearer YOUR_TOKEN" \\\n`;
    }
    
    content += `  -H "Content-Type: application/json"\n`;
    
    if (operation.requestBody) {
      content += `  -d '${this.generateExampleRequestBody(operation.requestBody)}'\n`;
    }
    
    content += `\`\`\`\n\n`;

    return content;
  }

  /**
   * Build schema Markdown
   */
  buildSchemaMarkdown(schemaName, schema) {
    let content = `### ${schemaName}\n\n`;

    if (schema.description) {
      content += `${schema.description}\n\n`;
    }

    if (schema.type === 'object' && schema.properties) {
      content += `#### Properties\n\n`;
      content += `| Property | Type | Required | Description |\n`;
      content += `|----------|------|----------|-------------|\n`;

      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const type = this.getSchemaTypeString(propSchema);
        const required = schema.required?.includes(propName) ? 'Yes' : 'No';
        const description = propSchema.description || '';
        content += `| ${propName} | ${type} | ${required} | ${description} |\n`;
      }
      content += `\n`;
    }

    // Example
    content += `#### Example\n\n`;
    content += `\`\`\`json\n`;
    content += JSON.stringify(this.generateSchemaExample(schema), null, 2);
    content += `\n\`\`\`\n\n`;

    return content;
  }

  /**
   * Build schema example
   */
  buildSchemaExample(schema) {
    let content = `\`\`\`json\n`;
    content += JSON.stringify(this.generateSchemaExample(schema), null, 2);
    content += `\n\`\`\`\n\n`;
    return content;
  }

  /**
   * Generate example from schema
   */
  generateSchemaExample(schema) {
    if (schema.$ref) {
      const refPath = schema.$ref.replace('#/components/schemas/', '');
      const referencedSchema = this.spec.components?.schemas?.[refPath];
      if (referencedSchema) {
        return this.generateSchemaExample(referencedSchema);
      }
    }

    switch (schema.type) {
      case 'object':
        const obj = {};
        if (schema.properties) {
          for (const [propName, propSchema] of Object.entries(schema.properties)) {
            obj[propName] = this.generateSchemaExample(propSchema);
          }
        }
        return obj;

      case 'array':
        if (schema.items) {
          return [this.generateSchemaExample(schema.items)];
        }
        return [];

      case 'string':
        if (schema.enum) return schema.enum[0];
        if (schema.format === 'email') return 'user@example.com';
        if (schema.format === 'date-time') return new Date().toISOString();
        if (schema.format === 'date') return new Date().toISOString().split('T')[0];
        if (schema.pattern === '^[a-f0-9]{32}$') return 'a1b2c3d4e5f6789012345678901234ab';
        return schema.example || 'string';

      case 'number':
      case 'integer':
        return schema.example || schema.minimum || 0;

      case 'boolean':
        return schema.example !== undefined ? schema.example : true;

      default:
        return null;
    }
  }

  /**
   * Generate example request body
   */
  generateExampleRequestBody(requestBody) {
    const mediaType = requestBody.content['application/json'];
    if (mediaType && mediaType.schema) {
      return JSON.stringify(this.generateSchemaExample(mediaType.schema));
    }
    return '{}';
  }

  /**
   * Get schema type string
   */
  getSchemaTypeString(schema) {
    if (schema.$ref) {
      return schema.$ref.replace('#/components/schemas/', '');
    }

    if (schema.enum) {
      return `enum: ${schema.enum.join(', ')}`;
    }

    if (schema.type === 'array' && schema.items) {
      return `${this.getSchemaTypeString(schema.items)}[]`;
    }

    return schema.type || 'any';
  }

  /**
   * Generate HTML documentation
   */
  async generateHtmlDocs(outputDir) {
    const htmlContent = this.buildHtmlContent();
    const outputPath = path.join(outputDir, 'api-reference.html');
    await fs.writeFile(outputPath, htmlContent, 'utf8');
    return outputPath;
  }

  /**
   * Build HTML content
   */
  buildHtmlContent() {
    const markdownContent = this.buildMarkdownContent();
    
    // Simple HTML wrapper (in a real implementation, you'd use a proper Markdown to HTML converter)
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.spec.info.title} - API Documentation</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 1200px; margin: 0 auto; padding: 20px; }
        h1, h2, h3 { color: #333; }
        code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
        pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f2f2f2; }
        .endpoint { margin: 30px 0; padding: 20px; border: 1px solid #e1e1e1; border-radius: 5px; }
        .method { display: inline-block; padding: 4px 8px; border-radius: 3px; color: white; font-weight: bold; }
        .method.get { background-color: #61affe; }
        .method.post { background-color: #49cc90; }
        .method.put { background-color: #fca130; }
        .method.delete { background-color: #f93e3e; }
        .method.patch { background-color: #50e3c2; }
    </style>
</head>
<body>
    <div id="content">
        <pre>${markdownContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
    </div>
</body>
</html>`;
  }

  /**
   * Generate Postman collection
   */
  async generatePostmanCollection(outputDir) {
    const collection = {
      info: {
        name: this.spec.info.title,
        description: this.spec.info.description,
        version: this.spec.info.version,
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
      },
      auth: {
        type: "bearer",
        bearer: [
          {
            key: "token",
            value: "{{authToken}}",
            type: "string"
          }
        ]
      },
      variable: [
        {
          key: "baseUrl",
          value: this.spec.servers?.[0]?.url || "http://localhost:3000",
          type: "string"
        },
        {
          key: "authToken",
          value: "",
          type: "string"
        }
      ],
      item: []
    };

    // Group by tags
    const endpointsByTag = this.groupEndpointsByTag();

    for (const [tag, endpoints] of Object.entries(endpointsByTag)) {
      const folder = {
        name: tag,
        item: []
      };

      for (const endpoint of endpoints) {
        const item = this.buildPostmanItem(endpoint);
        folder.item.push(item);
      }

      collection.item.push(folder);
    }

    const outputPath = path.join(outputDir, 'postman-collection.json');
    await fs.writeFile(outputPath, JSON.stringify(collection, null, 2), 'utf8');
    return outputPath;
  }

  /**
   * Build Postman item
   */
  buildPostmanItem(endpoint) {
    const { path, method, operation } = endpoint;
    
    const item = {
      name: operation.summary || `${method} ${path}`,
      request: {
        method: method,
        header: [
          {
            key: "Content-Type",
            value: "application/json",
            type: "text"
          }
        ],
        url: {
          raw: `{{baseUrl}}${path}`,
          host: ["{{baseUrl}}"],
          path: path.split('/').filter(p => p)
        }
      }
    };

    // Add auth if required
    if (operation.security || this.spec.security) {
      item.request.auth = {
        type: "bearer",
        bearer: [
          {
            key: "token",
            value: "{{authToken}}",
            type: "string"
          }
        ]
      };
    }

    // Add request body
    if (operation.requestBody) {
      const example = this.generateExampleRequestBody(operation.requestBody);
      item.request.body = {
        mode: "raw",
        raw: example,
        options: {
          raw: {
            language: "json"
          }
        }
      };
    }

    // Add query parameters
    if (operation.parameters) {
      const queryParams = operation.parameters.filter(p => p.in === 'query');
      if (queryParams.length > 0) {
        item.request.url.query = queryParams.map(param => ({
          key: param.name,
          value: this.generateParameterExample(param),
          description: param.description,
          disabled: !param.required
        }));
      }
    }

    return item;
  }

  /**
   * Generate parameter example
   */
  generateParameterExample(param) {
    if (param.schema) {
      return this.generateSchemaExample(param.schema);
    }
    return '';
  }

  /**
   * Generate Insomnia collection
   */
  async generateInsomniaCollection(outputDir) {
    const collection = {
      _type: "export",
      __export_format: 4,
      __export_date: new Date().toISOString(),
      __export_source: "note-management-api",
      resources: []
    };

    // Add workspace
    collection.resources.push({
      _id: "wrk_main",
      _type: "workspace",
      name: this.spec.info.title,
      description: this.spec.info.description
    });

    // Add environment
    collection.resources.push({
      _id: "env_main",
      _type: "environment",
      name: "Base Environment",
      data: {
        baseUrl: this.spec.servers?.[0]?.url || "http://localhost:3000",
        authToken: ""
      },
      parentId: "wrk_main"
    });

    // Add requests
    const endpointsByTag = this.groupEndpointsByTag();
    let requestId = 1;

    for (const [tag, endpoints] of Object.entries(endpointsByTag)) {
      // Add folder
      const folderId = `fld_${tag.toLowerCase().replace(/\s+/g, '_')}`;
      collection.resources.push({
        _id: folderId,
        _type: "request_group",
        name: tag,
        parentId: "wrk_main"
      });

      for (const endpoint of endpoints) {
        const request = this.buildInsomniaRequest(endpoint, `req_${requestId++}`, folderId);
        collection.resources.push(request);
      }
    }

    const outputPath = path.join(outputDir, 'insomnia-collection.json');
    await fs.writeFile(outputPath, JSON.stringify(collection, null, 2), 'utf8');
    return outputPath;
  }

  /**
   * Build Insomnia request
   */
  buildInsomniaRequest(endpoint, requestId, parentId) {
    const { path, method, operation } = endpoint;
    
    const request = {
      _id: requestId,
      _type: "request",
      name: operation.summary || `${method} ${path}`,
      method: method,
      url: `{{ _.baseUrl }}${path}`,
      headers: [
        {
          name: "Content-Type",
          value: "application/json"
        }
      ],
      parentId: parentId
    };

    // Add auth if required
    if (operation.security || this.spec.security) {
      request.authentication = {
        type: "bearer",
        token: "{{ _.authToken }}"
      };
    }

    // Add request body
    if (operation.requestBody) {
      const example = this.generateExampleRequestBody(operation.requestBody);
      request.body = {
        mimeType: "application/json",
        text: example
      };
    }

    return request;
  }

  /**
   * Generate README
   */
  async generateReadme(outputDir) {
    const readmeContent = `# ${this.spec.info.title}

${this.spec.info.description}

## Quick Start

1. **Base URL:** \`${this.spec.servers?.[0]?.url || 'http://localhost:3000'}\`
2. **Authentication:** Bearer token required for most endpoints
3. **Content Type:** \`application/json\`

## Authentication

To authenticate, send a POST request to \`/api/auth/login\` with your credentials:

\`\`\`bash
curl -X POST \\
  "${this.spec.servers?.[0]?.url || 'http://localhost:3000'}/api/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com",
    "password": "your-password"
  }'
\`\`\`

Use the returned token in the Authorization header for subsequent requests:

\`\`\`bash
curl -H "Authorization: Bearer YOUR_TOKEN" \\
  "${this.spec.servers?.[0]?.url || 'http://localhost:3000'}/api/notes"
\`\`\`

## Documentation

- **Interactive API Docs:** [Swagger UI](${this.spec.servers?.[0]?.url || 'http://localhost:3000'}/api-docs)
- **OpenAPI Spec:** [openapi.json](${this.spec.servers?.[0]?.url || 'http://localhost:3000'}/api/openapi.json)
- **Full API Reference:** [api-reference.md](./api-reference.md)

## Collections

Import these collections into your API client:

- **Postman:** [postman-collection.json](./postman-collection.json)
- **Insomnia:** [insomnia-collection.json](./insomnia-collection.json)

## Error Handling

All API responses follow a consistent format:

**Success Response:**
\`\`\`json
{
  "success": true,
  "data": { ... }
}
\`\`\`

**Error Response:**
\`\`\`json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  },
  "timestamp": "2024-01-01T00:00:00Z",
  "requestId": "req-123"
}
\`\`\`

## Rate Limiting

- Authentication endpoints: 5 requests per 15 minutes
- General API endpoints: 100 requests per minute

## Support

For API support, please contact: ${this.spec.info.contact?.email || 'support@example.com'}

## Version

Current API version: ${this.spec.info.version}
`;

    const outputPath = path.join(outputDir, 'README.md');
    await fs.writeFile(outputPath, readmeContent, 'utf8');
    return outputPath;
  }

  /**
   * Validate documentation completeness
   */
  validateDocumentation() {
    const issues = [];

    // Check if all endpoints have descriptions
    for (const [pathPattern, pathItem] of Object.entries(this.spec.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (typeof operation === 'object' && method !== 'parameters') {
          if (!operation.summary && !operation.description) {
            issues.push({
              type: 'missing_description',
              severity: 'warning',
              message: `${method.toUpperCase()} ${pathPattern} is missing summary/description`
            });
          }

          if (operation.parameters) {
            for (const param of operation.parameters) {
              if (!param.description) {
                issues.push({
                  type: 'missing_parameter_description',
                  severity: 'info',
                  message: `Parameter '${param.name}' in ${method.toUpperCase()} ${pathPattern} is missing description`
                });
              }
            }
          }
        }
      }
    }

    // Check if all schemas have descriptions
    if (this.spec.components?.schemas) {
      for (const [schemaName, schema] of Object.entries(this.spec.components.schemas)) {
        if (!schema.description) {
          issues.push({
            type: 'missing_schema_description',
            severity: 'info',
            message: `Schema '${schemaName}' is missing description`
          });
        }

        if (schema.properties) {
          for (const [propName, propSchema] of Object.entries(schema.properties)) {
            if (!propSchema.description) {
              issues.push({
                type: 'missing_property_description',
                severity: 'info',
                message: `Property '${propName}' in schema '${schemaName}' is missing description`
              });
            }
          }
        }
      }
    }

    return {
      valid: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      summary: {
        total: issues.length,
        errors: issues.filter(i => i.severity === 'error').length,
        warnings: issues.filter(i => i.severity === 'warning').length,
        info: issues.filter(i => i.severity === 'info').length
      }
    };
  }
}

module.exports = ApiDocumentationGenerator;