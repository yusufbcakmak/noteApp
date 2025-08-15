const ValidationMiddleware = require('../../src/middleware/validation');
const Joi = require('joi');

describe('ValidationMiddleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      query: {},
      params: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  describe('validateBody', () => {
    it('should pass validation with valid data', () => {
      const schema = Joi.object({
        name: Joi.string().required(),
        email: Joi.string().email().required()
      });

      req.body = {
        name: 'John Doe',
        email: 'john@example.com'
      };

      const middleware = ValidationMiddleware.validateBody(schema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should fail validation with invalid data', () => {
      const schema = Joi.object({
        name: Joi.string().required(),
        email: Joi.string().email().required()
      });

      req.body = {
        name: '',
        email: 'invalid-email'
      };

      const middleware = ValidationMiddleware.validateBody(schema);
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: expect.arrayContaining([
              expect.objectContaining({
                field: 'name',
                message: expect.stringContaining('empty')
              }),
              expect.objectContaining({
                field: 'email',
                message: expect.stringContaining('email')
              })
            ])
          })
        })
      );
    });

    it('should sanitize string inputs', () => {
      const schema = Joi.object({
        name: Joi.string().required(),
        description: Joi.string().optional()
      });

      req.body = {
        name: '  John <script>alert("xss")</script> Doe  ',
        description: 'Test & description with "quotes"'
      };

      const middleware = ValidationMiddleware.validateBody(schema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.body.name).toBe('John alert(&quot;xss&quot;) Doe');
      expect(req.body.description).toBe('Test &amp; description with &quot;quotes&quot;');
    });

    it('should strip unknown fields', () => {
      const schema = Joi.object({
        name: Joi.string().required()
      });

      req.body = {
        name: 'John Doe',
        unknownField: 'should be removed'
      };

      const middleware = ValidationMiddleware.validateBody(schema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.body).toEqual({ name: 'John Doe' });
    });
  });

  describe('validateQuery', () => {
    it('should pass validation with valid query parameters', () => {
      const schema = Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(10)
      });

      req.query = {
        page: '2',
        limit: '20'
      };

      const middleware = ValidationMiddleware.validateQuery(schema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.query.page).toBe(2);
      expect(req.query.limit).toBe(20);
    });

    it('should fail validation with invalid query parameters', () => {
      const schema = Joi.object({
        page: Joi.number().integer().min(1).required()
      });

      req.query = {
        page: 'invalid'
      };

      const middleware = ValidationMiddleware.validateQuery(schema);
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'Query validation failed'
          })
        })
      );
    });
  });

  describe('validateParams', () => {
    it('should pass validation with valid parameters', () => {
      const schema = Joi.object({
        id: Joi.string().pattern(/^[a-f0-9]{32}$/).required()
      });

      req.params = {
        id: 'a1b2c3d4e5f6789012345678901234ab'
      };

      const middleware = ValidationMiddleware.validateParams(schema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should fail validation with invalid parameters', () => {
      const schema = Joi.object({
        id: Joi.string().pattern(/^[a-f0-9]{32}$/).required()
      });

      req.params = {
        id: 'invalid-id'
      };

      const middleware = ValidationMiddleware.validateParams(schema);
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'Parameter validation failed'
          })
        })
      );
    });
  });

  describe('validate (combined)', () => {
    it('should validate all request parts', () => {
      const schemas = {
        params: Joi.object({
          id: Joi.string().pattern(/^[a-f0-9]{32}$/).required()
        }),
        body: Joi.object({
          name: Joi.string().required()
        }),
        query: Joi.object({
          page: Joi.number().integer().min(1).default(1)
        })
      };

      req.params = { id: 'a1b2c3d4e5f6789012345678901234ab' };
      req.body = { name: 'Test Name' };
      req.query = { page: '2' };

      const middleware = ValidationMiddleware.validate(schemas);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.query.page).toBe(2);
    });

    it('should collect errors from all request parts', () => {
      const schemas = {
        params: Joi.object({
          id: Joi.string().pattern(/^[a-f0-9]{32}$/).required()
        }),
        body: Joi.object({
          name: Joi.string().required()
        })
      };

      req.params = { id: 'invalid-id' };
      req.body = { name: '' };

      const middleware = ValidationMiddleware.validate(schemas);
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            details: expect.arrayContaining([
              expect.objectContaining({ type: 'params' }),
              expect.objectContaining({ type: 'body' })
            ])
          })
        })
      );
    });
  });

  describe('_sanitizeString', () => {
    it('should remove HTML tags', () => {
      const result = ValidationMiddleware._sanitizeString('<script>alert("xss")</script>Hello');
      expect(result).toBe('alert(&quot;xss&quot;)Hello');
    });

    it('should escape dangerous characters', () => {
      const result = ValidationMiddleware._sanitizeString('Test & "quotes" <tag>');
      expect(result).toBe('Test &amp; &quot;quotes&quot;');
    });

    it('should trim whitespace', () => {
      const result = ValidationMiddleware._sanitizeString('  Hello World  ');
      expect(result).toBe('Hello World');
    });

    it('should handle non-string inputs', () => {
      expect(ValidationMiddleware._sanitizeString(123)).toBe(123);
      expect(ValidationMiddleware._sanitizeString(null)).toBe(null);
      expect(ValidationMiddleware._sanitizeString(undefined)).toBe(undefined);
    });
  });

  describe('_sanitizeObject', () => {
    it('should sanitize nested objects', () => {
      const input = {
        name: '  <script>alert("xss")</script>John  ',
        details: {
          description: 'Test & description',
          tags: ['<tag1>', 'tag2  ']
        }
      };

      const result = ValidationMiddleware._sanitizeObject(input);

      expect(result).toEqual({
        name: 'alert(&quot;xss&quot;)John',
        details: {
          description: 'Test &amp; description',
          tags: ['', 'tag2']
        }
      });
    });

    it('should handle arrays', () => {
      const input = ['  <script>  ', 'normal text', '  '];
      const result = ValidationMiddleware._sanitizeObject(input);
      expect(result).toEqual(['', 'normal text', '']);
    });

    it('should handle primitive values', () => {
      expect(ValidationMiddleware._sanitizeObject(null)).toBe(null);
      expect(ValidationMiddleware._sanitizeObject(undefined)).toBe(undefined);
      expect(ValidationMiddleware._sanitizeObject(123)).toBe(123);
      expect(ValidationMiddleware._sanitizeObject(true)).toBe(true);
    });
  });
});