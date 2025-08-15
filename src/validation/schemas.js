const Joi = require('joi');
const User = require('../models/User');

/**
 * Validation schemas for API endpoints
 */

// Common validation patterns
const patterns = {
  id: Joi.string().pattern(/^[a-f0-9]{32}$/).required(),
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string().min(6).max(128).required(),
  name: Joi.string().trim().min(1).max(255),
  description: Joi.string().trim().max(2000).allow(''),
  status: Joi.string().valid('todo', 'in_progress', 'done'),
  priority: Joi.string().valid('low', 'medium', 'high'),
  color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),
  pagination: {
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10)
  },
  sort: {
    sortBy: Joi.string().valid('created_at', 'updated_at', 'title', 'priority', 'status', 'name').default('created_at'),
    sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC')
  }
};

// Authentication schemas (using User model schemas)
const authSchemas = {
  register: User.registrationSchema,
  login: User.loginSchema,

  refreshToken: Joi.object({
    refreshToken: Joi.string().required()
  }),

  changePassword: Joi.object({
    currentPassword: patterns.password,
    newPassword: patterns.password
  }),

  forgotPassword: Joi.object({
    email: patterns.email
  })
};

// Note schemas
const noteSchemas = {
  create: Joi.object({
    title: patterns.name.required(),
    description: patterns.description.optional(),
    priority: patterns.priority.default('medium'),
    groupId: Joi.string().pattern(/^[a-f0-9]{32}$/).allow(null, '').optional()
  }),

  update: Joi.object({
    title: patterns.name.optional(),
    description: patterns.description.optional(),
    status: patterns.status.optional(),
    priority: patterns.priority.optional(),
    groupId: Joi.string().pattern(/^[a-f0-9]{32}$/).allow(null, '').optional()
  }).min(1),

  statusUpdate: Joi.object({
    status: patterns.status.required()
  }),

  query: Joi.object({
    page: patterns.pagination.page,
    limit: patterns.pagination.limit,
    status: patterns.status.optional(),
    priority: patterns.priority.optional(),
    groupId: Joi.string().pattern(/^[a-f0-9]{32}$/).allow(null, '').optional(),
    search: Joi.string().trim().max(255).optional(),
    sortBy: patterns.sort.sortBy,
    sortOrder: patterns.sort.sortOrder
  }),

  recentQuery: Joi.object({
    limit: Joi.number().integer().min(1).max(20).default(5)
  })
};

// Group schemas
const groupSchemas = {
  create: Joi.object({
    name: patterns.name.required(),
    description: patterns.description.optional(),
    color: patterns.color.default('#3498db')
  }),

  update: Joi.object({
    name: patterns.name.optional(),
    description: patterns.description.optional(),
    color: patterns.color.optional()
  }).min(1),

  query: Joi.object({
    page: patterns.pagination.page,
    limit: patterns.pagination.limit,
    search: Joi.string().trim().max(255).optional(),
    sortBy: patterns.sort.sortBy,
    sortOrder: patterns.sort.sortOrder,
    includeNoteCounts: Joi.string().valid('true', 'false').default('false')
  }),

  deleteQuery: Joi.object({
    reassignNotes: Joi.string().valid('true', 'false').default('true')
  })
};

// User schemas
const userSchemas = {
  updateProfile: Joi.object({
    firstName: patterns.name.optional(),
    lastName: patterns.name.optional(),
    email: patterns.email.optional(),
    currentPassword: Joi.string().when('newPassword', {
      is: Joi.exist(),
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    newPassword: patterns.password.optional()
  }).min(1),

  deleteAccount: Joi.object({
    password: patterns.password,
    confirmation: Joi.string().valid('DELETE_MY_ACCOUNT').required()
  })
};

// History schemas
const historySchemas = {
  query: Joi.object({
    page: patterns.pagination.page,
    limit: patterns.pagination.limit,
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
    sortBy: Joi.string().valid('completed_at', 'created_at', 'title', 'priority').default('completed_at'),
    sortOrder: patterns.sort.sortOrder
  }),

  dailyQuery: Joi.object({
    date: Joi.date().iso().optional(),
    days: Joi.number().integer().min(1).max(365).default(30)
  })
};

// Parameter schemas
const paramSchemas = {
  id: Joi.object({
    id: patterns.id
  })
};

module.exports = {
  patterns,
  authSchemas,
  noteSchemas,
  groupSchemas,
  userSchemas,
  historySchemas,
  paramSchemas
};