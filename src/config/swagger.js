const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const config = require('./environment');
const { patterns, authSchemas, noteSchemas, groupSchemas, userSchemas, historySchemas } = require('../validation/schemas');

/**
 * Swagger/OpenAPI configuration and setup
 */
class SwaggerConfig {
  constructor() {
    this.options = {
      definition: {
        openapi: '3.0.0',
        info: {
          title: 'Note Management API',
          version: config.get('app.version'),
          description: 'A SaaS note management application with Jira-like interface',
          contact: {
            name: 'API Support',
            email: 'support@notemanagement.com'
          },
          license: {
            name: 'MIT',
            url: 'https://opensource.org/licenses/MIT'
          }
        },
        servers: [
          {
            url: `http://localhost:${config.get('server.port')}`,
            description: 'Development server'
          },
          {
            url: 'https://api.notemanagement.com',
            description: 'Production server'
          }
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
              description: 'JWT token for authentication'
            }
          },
          schemas: this.generateSchemas(),
          responses: this.generateCommonResponses(),
          parameters: this.generateCommonParameters()
        },
        security: [
          {
            bearerAuth: []
          }
        ],
        tags: [
          {
            name: 'Authentication',
            description: 'User authentication and authorization'
          },
          {
            name: 'Notes',
            description: 'Note management operations'
          },
          {
            name: 'Groups',
            description: 'Group management operations'
          },
          {
            name: 'History',
            description: 'Completed notes history and analytics'
          },
          {
            name: 'User',
            description: 'User profile management'
          },
          {
            name: 'System',
            description: 'System health and information'
          }
        ]
      },
      apis: [
        './src/routes/*.js',
        './src/controllers/*.js',
        './src/models/*.js'
      ]
    };
  }

  /**
   * Generate OpenAPI schemas from Joi validation schemas
   */
  generateSchemas() {
    return {
      // User schemas
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^[a-f0-9]{32}$', description: 'User ID' },
          email: { type: 'string', format: 'email', description: 'User email address' },
          firstName: { type: 'string', maxLength: 255, description: 'User first name' },
          lastName: { type: 'string', maxLength: 255, description: 'User last name' },
          isActive: { type: 'boolean', description: 'User active status' },
          createdAt: { type: 'string', format: 'date-time', description: 'User creation timestamp' },
          updatedAt: { type: 'string', format: 'date-time', description: 'User last update timestamp' },
          lastLoginAt: { type: 'string', format: 'date-time', nullable: true, description: 'Last login timestamp' }
        },
        required: ['id', 'email', 'firstName', 'lastName', 'isActive', 'createdAt', 'updatedAt']
      },

      // Note schemas
      Note: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^[a-f0-9]{32}$', description: 'Note ID' },
          userId: { type: 'string', pattern: '^[a-f0-9]{32}$', description: 'Owner user ID' },
          groupId: { type: 'string', pattern: '^[a-f0-9]{32}$', nullable: true, description: 'Group ID' },
          title: { type: 'string', maxLength: 255, description: 'Note title' },
          description: { type: 'string', maxLength: 2000, description: 'Note description' },
          status: { type: 'string', enum: ['todo', 'in_progress', 'done'], description: 'Note status' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Note priority' },
          createdAt: { type: 'string', format: 'date-time', description: 'Note creation timestamp' },
          updatedAt: { type: 'string', format: 'date-time', description: 'Note last update timestamp' },
          completedAt: { type: 'string', format: 'date-time', nullable: true, description: 'Note completion timestamp' }
        },
        required: ['id', 'userId', 'title', 'status', 'priority', 'createdAt', 'updatedAt']
      },

      // Group schemas
      Group: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^[a-f0-9]{32}$', description: 'Group ID' },
          userId: { type: 'string', pattern: '^[a-f0-9]{32}$', description: 'Owner user ID' },
          name: { type: 'string', maxLength: 255, description: 'Group name' },
          description: { type: 'string', maxLength: 2000, description: 'Group description' },
          color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$', description: 'Group color (hex)' },
          createdAt: { type: 'string', format: 'date-time', description: 'Group creation timestamp' },
          updatedAt: { type: 'string', format: 'date-time', description: 'Group last update timestamp' },
          noteCount: { type: 'integer', description: 'Number of notes in group (when included)' }
        },
        required: ['id', 'userId', 'name', 'color', 'createdAt', 'updatedAt']
      },

      // Completed Note schemas
      CompletedNote: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^[a-f0-9]{32}$', description: 'Completed note ID' },
          userId: { type: 'string', pattern: '^[a-f0-9]{32}$', description: 'Owner user ID' },
          originalNoteId: { type: 'string', pattern: '^[a-f0-9]{32}$', description: 'Original note ID' },
          title: { type: 'string', maxLength: 255, description: 'Note title' },
          description: { type: 'string', maxLength: 2000, description: 'Note description' },
          groupName: { type: 'string', maxLength: 255, nullable: true, description: 'Group name at completion' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Note priority' },
          completedAt: { type: 'string', format: 'date-time', description: 'Note completion timestamp' },
          createdAt: { type: 'string', format: 'date-time', description: 'Original note creation timestamp' }
        },
        required: ['id', 'userId', 'originalNoteId', 'title', 'priority', 'completedAt', 'createdAt']
      },

      // Request/Response schemas
      LoginRequest: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email', description: 'User email' },
          password: { type: 'string', minLength: 6, maxLength: 128, description: 'User password' }
        },
        required: ['email', 'password']
      },

      RegisterRequest: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email', description: 'User email' },
          password: { type: 'string', minLength: 6, maxLength: 128, description: 'User password' },
          firstName: { type: 'string', maxLength: 255, description: 'User first name' },
          lastName: { type: 'string', maxLength: 255, description: 'User last name' }
        },
        required: ['email', 'password', 'firstName', 'lastName']
      },

      AuthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              user: { $ref: '#/components/schemas/User' },
              token: { type: 'string', description: 'JWT access token' },
              refreshToken: { type: 'string', description: 'JWT refresh token' },
              expiresIn: { type: 'integer', description: 'Token expiration time in seconds' }
            }
          }
        }
      },

      CreateNoteRequest: {
        type: 'object',
        properties: {
          title: { type: 'string', maxLength: 255, description: 'Note title' },
          description: { type: 'string', maxLength: 2000, description: 'Note description' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'], default: 'medium', description: 'Note priority' },
          groupId: { type: 'string', pattern: '^[a-f0-9]{32}$', nullable: true, description: 'Group ID' }
        },
        required: ['title']
      },

      UpdateNoteRequest: {
        type: 'object',
        properties: {
          title: { type: 'string', maxLength: 255, description: 'Note title' },
          description: { type: 'string', maxLength: 2000, description: 'Note description' },
          status: { type: 'string', enum: ['todo', 'in_progress', 'done'], description: 'Note status' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Note priority' },
          groupId: { type: 'string', pattern: '^[a-f0-9]{32}$', nullable: true, description: 'Group ID' }
        },
        minProperties: 1
      },

      CreateGroupRequest: {
        type: 'object',
        properties: {
          name: { type: 'string', maxLength: 255, description: 'Group name' },
          description: { type: 'string', maxLength: 2000, description: 'Group description' },
          color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$', default: '#3498db', description: 'Group color (hex)' }
        },
        required: ['name']
      },

      // Common response schemas
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object', description: 'Response data' },
          message: { type: 'string', description: 'Success message' }
        },
        required: ['success']
      },

      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', description: 'Error code' },
              message: { type: 'string', description: 'Error message' },
              details: { type: 'object', description: 'Additional error details' }
            },
            required: ['code', 'message']
          },
          timestamp: { type: 'string', format: 'date-time', description: 'Error timestamp' },
          requestId: { type: 'string', description: 'Request ID for tracking' }
        },
        required: ['success', 'error']
      },

      PaginatedResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              items: { type: 'array', items: { type: 'object' }, description: 'Data items' },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'integer', description: 'Current page number' },
                  limit: { type: 'integer', description: 'Items per page' },
                  total: { type: 'integer', description: 'Total number of items' },
                  totalPages: { type: 'integer', description: 'Total number of pages' },
                  hasNext: { type: 'boolean', description: 'Has next page' },
                  hasPrev: { type: 'boolean', description: 'Has previous page' }
                },
                required: ['page', 'limit', 'total', 'totalPages', 'hasNext', 'hasPrev']
              }
            },
            required: ['items', 'pagination']
          }
        },
        required: ['success', 'data']
      },

      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'OK' },
          timestamp: { type: 'string', format: 'date-time' },
          environment: { type: 'string', description: 'Environment name' },
          version: { type: 'string', description: 'Application version' },
          database: { type: 'string', enum: ['connected', 'disconnected'] },
          uptime: { type: 'number', description: 'Process uptime in seconds' }
        },
        required: ['status', 'timestamp', 'environment', 'version', 'database', 'uptime']
      }
    };
  }

  /**
   * Generate common response definitions
   */
  generateCommonResponses() {
    return {
      Success: {
        description: 'Successful operation',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/SuccessResponse' }
          }
        }
      },
      BadRequest: {
        description: 'Bad request - validation error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Validation failed',
                details: {
                  field: 'title',
                  message: 'Title is required'
                }
              },
              timestamp: '2024-01-01T00:00:00Z',
              requestId: 'req-123'
            }
          }
        }
      },
      Unauthorized: {
        description: 'Unauthorized - authentication required',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required'
              },
              timestamp: '2024-01-01T00:00:00Z',
              requestId: 'req-123'
            }
          }
        }
      },
      Forbidden: {
        description: 'Forbidden - insufficient permissions',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: {
                code: 'FORBIDDEN',
                message: 'Insufficient permissions'
              },
              timestamp: '2024-01-01T00:00:00Z',
              requestId: 'req-123'
            }
          }
        }
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: 'Resource not found'
              },
              timestamp: '2024-01-01T00:00:00Z',
              requestId: 'req-123'
            }
          }
        }
      },
      Conflict: {
        description: 'Conflict - resource already exists',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: {
                code: 'CONFLICT',
                message: 'Resource already exists'
              },
              timestamp: '2024-01-01T00:00:00Z',
              requestId: 'req-123'
            }
          }
        }
      },
      TooManyRequests: {
        description: 'Too many requests - rate limit exceeded',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests'
              },
              timestamp: '2024-01-01T00:00:00Z',
              requestId: 'req-123'
            }
          }
        }
      },
      InternalServerError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An unexpected error occurred'
              },
              timestamp: '2024-01-01T00:00:00Z',
              requestId: 'req-123'
            }
          }
        }
      }
    };
  }

  /**
   * Generate common parameters
   */
  generateCommonParameters() {
    return {
      IdParam: {
        name: 'id',
        in: 'path',
        required: true,
        schema: {
          type: 'string',
          pattern: '^[a-f0-9]{32}$'
        },
        description: 'Resource ID'
      },
      PageParam: {
        name: 'page',
        in: 'query',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          default: 1
        },
        description: 'Page number for pagination'
      },
      LimitParam: {
        name: 'limit',
        in: 'query',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 10
        },
        description: 'Number of items per page'
      },
      SortByParam: {
        name: 'sortBy',
        in: 'query',
        required: false,
        schema: {
          type: 'string',
          enum: ['created_at', 'updated_at', 'title', 'priority', 'status', 'name'],
          default: 'created_at'
        },
        description: 'Field to sort by'
      },
      SortOrderParam: {
        name: 'sortOrder',
        in: 'query',
        required: false,
        schema: {
          type: 'string',
          enum: ['ASC', 'DESC'],
          default: 'DESC'
        },
        description: 'Sort order'
      }
    };
  }

  /**
   * Get Swagger specification
   */
  getSpec() {
    return swaggerJSDoc(this.options);
  }

  /**
   * Get Swagger UI middleware
   */
  getUiMiddleware() {
    const spec = this.getSpec();
    return swaggerUi.setup(spec, {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Note Management API Documentation'
    });
  }

  /**
   * Get Swagger UI serve middleware
   */
  getServeMiddleware() {
    return swaggerUi.serve;
  }
}

module.exports = SwaggerConfig;