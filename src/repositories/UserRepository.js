const User = require('../models/User');
const dbConnection = require('../config/database');

/**
 * User repository for database operations
 */
class UserRepository {
  constructor() {
    this.db = null;
  }

  /**
   * Initialize repository with database connection
   */
  init() {
    this.db = dbConnection.getDatabase();
    return this;
  }

  /**
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Promise<User>} - Created user
   */
  async create(userData) {
    try {
      // Generate ID if not provided
      if (!userData.id) {
        userData.id = this._generateId();
      }

      // Set timestamps
      const now = new Date().toISOString();
      userData.createdAt = now;
      userData.updatedAt = now;

      // Hash password
      if (userData.password) {
        userData.password = await User.hashPassword(userData.password);
      }

      const user = new User(userData);
      const dbData = user.toDatabaseFormat();

      const query = `
        INSERT INTO users (
          id, email, password, first_name, last_name, 
          created_at, updated_at, is_active, last_login_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        dbData.id,
        dbData.email,
        dbData.password,
        dbData.first_name,
        dbData.last_name,
        dbData.created_at,
        dbData.updated_at,
        dbData.is_active,
        dbData.last_login_at
      ];

      const result = this.db.prepare(query).run(params);

      if (result.changes === 0) {
        throw new Error('Failed to create user');
      }

      return this.findById(user.id);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error('Email already exists');
      }
      throw error;
    }
  }

  /**
   * Find user by ID
   * @param {string} id - User ID
   * @returns {Promise<User|null>} - User or null if not found
   */
  async findById(id) {
    try {
      const query = 'SELECT * FROM users WHERE id = ? AND is_active = 1';
      const row = this.db.prepare(query).get(id);
      return User.fromDatabaseRow(row);
    } catch (error) {
      throw new Error(`Failed to find user by ID: ${error.message}`);
    }
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Promise<User|null>} - User or null if not found
   */
  async findByEmail(email) {
    try {
      const query = 'SELECT * FROM users WHERE email = ? AND is_active = 1';
      const row = this.db.prepare(query).get(email.toLowerCase());
      return User.fromDatabaseRow(row);
    } catch (error) {
      throw new Error(`Failed to find user by email: ${error.message}`);
    }
  }

  /**
   * Find user by email (including inactive users)
   * @param {string} email - User email
   * @returns {Promise<User|null>} - User or null if not found
   */
  async findByEmailIncludingInactive(email) {
    try {
      const query = 'SELECT * FROM users WHERE email = ?';
      const row = this.db.prepare(query).get(email.toLowerCase());
      return User.fromDatabaseRow(row);
    } catch (error) {
      throw new Error(`Failed to find user by email: ${error.message}`);
    }
  }

  /**
   * Update user
   * @param {string} id - User ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<User|null>} - Updated user or null if not found
   */
  async update(id, updateData) {
    try {
      // Set updated timestamp
      updateData.updatedAt = new Date().toISOString();

      // Hash password if provided
      if (updateData.password) {
        updateData.password = await User.hashPassword(updateData.password);
      }

      const user = new User(updateData);
      const dbData = user.toDatabaseFormat();

      // Build dynamic update query
      const updateFields = [];
      const params = [];

      Object.keys(dbData).forEach(key => {
        if (key !== 'id' && dbData[key] !== undefined && dbData[key] !== null) {
          updateFields.push(`${key} = ?`);
          params.push(dbData[key]);
        }
      });

      if (updateFields.length === 0) {
        throw new Error('No fields to update');
      }

      params.push(id);

      const query = `
        UPDATE users 
        SET ${updateFields.join(', ')} 
        WHERE id = ? AND is_active = 1
      `;

      const result = this.db.prepare(query).run(params);

      if (result.changes === 0) {
        return null; // User not found or no changes made
      }

      return this.findById(id);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error('Email already exists');
      }
      throw error;
    }
  }

  /**
   * Update user's last login timestamp
   * @param {string} id - User ID
   * @returns {Promise<boolean>} - True if updated successfully
   */
  async updateLastLogin(id) {
    try {
      const now = new Date().toISOString();
      const query = `
        UPDATE users 
        SET last_login_at = ?, updated_at = ? 
        WHERE id = ? AND is_active = 1
      `;

      const result = this.db.prepare(query).run(now, now, id);
      return result.changes > 0;
    } catch (error) {
      throw new Error(`Failed to update last login: ${error.message}`);
    }
  }

  /**
   * Soft delete user (set is_active to false)
   * @param {string} id - User ID
   * @returns {Promise<boolean>} - True if deleted successfully
   */
  async softDelete(id) {
    try {
      const now = new Date().toISOString();
      const query = `
        UPDATE users 
        SET is_active = 0, updated_at = ? 
        WHERE id = ? AND is_active = 1
      `;

      const result = this.db.prepare(query).run(now, id);
      return result.changes > 0;
    } catch (error) {
      throw new Error(`Failed to soft delete user: ${error.message}`);
    }
  }

  /**
   * Hard delete user (permanent deletion)
   * @param {string} id - User ID
   * @returns {Promise<boolean>} - True if deleted successfully
   */
  async hardDelete(id) {
    try {
      const query = 'DELETE FROM users WHERE id = ?';
      const result = this.db.prepare(query).run(id);
      return result.changes > 0;
    } catch (error) {
      throw new Error(`Failed to hard delete user: ${error.message}`);
    }
  }

  /**
   * Check if email exists
   * @param {string} email - Email to check
   * @param {string} excludeId - User ID to exclude from check (for updates)
   * @returns {Promise<boolean>} - True if email exists
   */
  async emailExists(email, excludeId = null) {
    try {
      let query = 'SELECT COUNT(*) as count FROM users WHERE email = ?';
      const params = [email.toLowerCase()];

      if (excludeId) {
        query += ' AND id != ?';
        params.push(excludeId);
      }

      const result = this.db.prepare(query).get(params);
      return result.count > 0;
    } catch (error) {
      throw new Error(`Failed to check email existence: ${error.message}`);
    }
  }

  /**
   * Get user count
   * @returns {Promise<number>} - Total number of active users
   */
  async getCount() {
    try {
      const query = 'SELECT COUNT(*) as count FROM users WHERE is_active = 1';
      const result = this.db.prepare(query).get();
      return result.count;
    } catch (error) {
      throw new Error(`Failed to get user count: ${error.message}`);
    }
  }

  /**
   * Find users with pagination
   * @param {Object} options - Pagination options
   * @returns {Promise<Object>} - Users with pagination info
   */
  async findWithPagination(options = {}) {
    try {
      const { page = 1, limit = 10, search = '' } = options;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE is_active = 1';
      const params = [];

      if (search) {
        whereClause += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)';
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) as count FROM users ${whereClause}`;
      const countResult = this.db.prepare(countQuery).get(params);
      const total = countResult.count;

      // Get users
      const usersQuery = `
        SELECT * FROM users ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;
      const usersParams = [...params, limit, offset];
      const rows = this.db.prepare(usersQuery).all(usersParams);

      const users = rows.map(row => User.fromDatabaseRow(row));

      return {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      };
    } catch (error) {
      throw new Error(`Failed to find users with pagination: ${error.message}`);
    }
  }

  /**
   * Generate a unique ID for user
   * @returns {string} - Generated ID
   */
  _generateId() {
    // Generate a random hex string (similar to SQLite's hex(randomblob(16)))
    const bytes = require('crypto').randomBytes(16);
    return bytes.toString('hex').toLowerCase();
  }
}

module.exports = UserRepository;