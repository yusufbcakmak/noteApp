const Group = require('../models/Group');
const dbConnection = require('../config/database');

/**
 * Group repository for database operations
 */
class GroupRepository {
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
   * Create a new group
   * @param {Object} groupData - Group data
   * @returns {Promise<Group>} - Created group
   */
  async create(groupData) {
    try {
      // Generate ID if not provided
      if (!groupData.id) {
        groupData.id = this._generateId();
      }

      // Set timestamps
      const now = new Date().toISOString();
      groupData.createdAt = now;
      groupData.updatedAt = now;

      // Set default color if not provided
      if (!groupData.color) {
        groupData.color = '#3498db';
      }

      const group = new Group(groupData);
      const dbData = group.toDatabaseFormat();

      const query = `
        INSERT INTO groups (
          id, user_id, name, description, color, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        dbData.id,
        dbData.user_id,
        dbData.name,
        dbData.description,
        dbData.color,
        dbData.created_at,
        dbData.updated_at
      ];

      const result = this.db.prepare(query).run(params);

      if (result.changes === 0) {
        throw new Error('Failed to create group');
      }

      return this.findById(group.id);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error('Group name already exists for this user');
      }
      throw error;
    }
  }

  /**
   * Find group by ID
   * @param {string} id - Group ID
   * @returns {Promise<Group|null>} - Group or null if not found
   */
  async findById(id) {
    try {
      const query = 'SELECT * FROM groups WHERE id = ?';
      const row = this.db.prepare(query).get(id);
      return Group.fromDatabaseRow(row);
    } catch (error) {
      throw new Error(`Failed to find group by ID: ${error.message}`);
    }
  }

  /**
   * Find group by ID and user ID (for authorization)
   * @param {string} id - Group ID
   * @param {string} userId - User ID
   * @returns {Promise<Group|null>} - Group or null if not found
   */
  async findByIdAndUserId(id, userId) {
    try {
      const query = 'SELECT * FROM groups WHERE id = ? AND user_id = ?';
      const row = this.db.prepare(query).get(id, userId);
      return Group.fromDatabaseRow(row);
    } catch (error) {
      throw new Error(`Failed to find group by ID and user ID: ${error.message}`);
    }
  }

  /**
   * Find all groups for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array<Group>>} - Array of groups
   */
  async findByUserId(userId, options = {}) {
    try {
      const { orderBy = 'created_at', orderDirection = 'DESC' } = options;
      
      const query = `
        SELECT * FROM groups 
        WHERE user_id = ? 
        ORDER BY ${orderBy} ${orderDirection}
      `;
      
      const rows = this.db.prepare(query).all(userId);
      return rows.map(row => Group.fromDatabaseRow(row));
    } catch (error) {
      throw new Error(`Failed to find groups by user ID: ${error.message}`);
    }
  }

  /**
   * Find group by name and user ID
   * @param {string} name - Group name
   * @param {string} userId - User ID
   * @param {string} excludeId - Group ID to exclude from search (for updates)
   * @returns {Promise<Group|null>} - Group or null if not found
   */
  async findByNameAndUserId(name, userId, excludeId = null) {
    try {
      let query = 'SELECT * FROM groups WHERE name = ? AND user_id = ?';
      const params = [name, userId];

      if (excludeId) {
        query += ' AND id != ?';
        params.push(excludeId);
      }

      const row = this.db.prepare(query).get(params);
      return Group.fromDatabaseRow(row);
    } catch (error) {
      throw new Error(`Failed to find group by name and user ID: ${error.message}`);
    }
  }

  /**
   * Update group
   * @param {string} id - Group ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Group|null>} - Updated group or null if not found
   */
  async update(id, updateData) {
    try {
      // Set updated timestamp
      updateData.updatedAt = new Date().toISOString();

      const group = new Group(updateData);
      const dbData = group.toDatabaseFormat();

      // Build dynamic update query
      const updateFields = [];
      const params = [];

      Object.keys(dbData).forEach(key => {
        if (key !== 'id' && key !== 'user_id' && dbData[key] !== undefined && dbData[key] !== null) {
          updateFields.push(`${key} = ?`);
          params.push(dbData[key]);
        }
      });

      if (updateFields.length === 0) {
        throw new Error('No fields to update');
      }

      params.push(id);

      const query = `
        UPDATE groups 
        SET ${updateFields.join(', ')} 
        WHERE id = ?
      `;

      const result = this.db.prepare(query).run(params);

      if (result.changes === 0) {
        return null; // Group not found or no changes made
      }

      return this.findById(id);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error('Group name already exists for this user');
      }
      throw error;
    }
  }

  /**
   * Delete group
   * @param {string} id - Group ID
   * @returns {Promise<boolean>} - True if deleted successfully
   */
  async delete(id) {
    try {
      const query = 'DELETE FROM groups WHERE id = ?';
      const result = this.db.prepare(query).run(id);
      return result.changes > 0;
    } catch (error) {
      throw new Error(`Failed to delete group: ${error.message}`);
    }
  }

  /**
   * Delete group and reassign notes to null (ungrouped)
   * @param {string} id - Group ID
   * @returns {Promise<boolean>} - True if deleted successfully
   */
  async deleteAndReassignNotes(id) {
    try {
      // Start transaction
      const deleteGroup = this.db.prepare('DELETE FROM groups WHERE id = ?');
      const updateNotes = this.db.prepare('UPDATE notes SET group_id = NULL WHERE group_id = ?');

      const transaction = this.db.transaction(() => {
        updateNotes.run(id);
        const result = deleteGroup.run(id);
        return result.changes > 0;
      });

      return transaction();
    } catch (error) {
      throw new Error(`Failed to delete group and reassign notes: ${error.message}`);
    }
  }

  /**
   * Get group count for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} - Total number of groups for user
   */
  async getCountByUserId(userId) {
    try {
      const query = 'SELECT COUNT(*) as count FROM groups WHERE user_id = ?';
      const result = this.db.prepare(query).get(userId);
      return result.count;
    } catch (error) {
      throw new Error(`Failed to get group count: ${error.message}`);
    }
  }

  /**
   * Get groups with note counts
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Array of groups with note counts
   */
  async findWithNoteCounts(userId) {
    try {
      const query = `
        SELECT 
          g.*,
          COUNT(n.id) as note_count
        FROM groups g
        LEFT JOIN notes n ON g.id = n.group_id AND n.status != 'done'
        WHERE g.user_id = ?
        GROUP BY g.id
        ORDER BY g.created_at DESC
      `;
      
      const rows = this.db.prepare(query).all(userId);
      return rows.map(row => ({
        ...Group.fromDatabaseRow(row).toJSON(),
        noteCount: row.note_count
      }));
    } catch (error) {
      throw new Error(`Failed to find groups with note counts: ${error.message}`);
    }
  }

  /**
   * Check if group name exists for user
   * @param {string} name - Group name
   * @param {string} userId - User ID
   * @param {string} excludeId - Group ID to exclude from check (for updates)
   * @returns {Promise<boolean>} - True if name exists
   */
  async nameExistsForUser(name, userId, excludeId = null) {
    try {
      let query = 'SELECT COUNT(*) as count FROM groups WHERE name = ? AND user_id = ?';
      const params = [name, userId];

      if (excludeId) {
        query += ' AND id != ?';
        params.push(excludeId);
      }

      const result = this.db.prepare(query).get(params);
      return result.count > 0;
    } catch (error) {
      throw new Error(`Failed to check group name existence: ${error.message}`);
    }
  }

  /**
   * Find groups with pagination
   * @param {string} userId - User ID
   * @param {Object} options - Pagination options
   * @returns {Promise<Object>} - Groups with pagination info
   */
  async findWithPagination(userId, options = {}) {
    try {
      const { page = 1, limit = 10, search = '' } = options;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE user_id = ?';
      const params = [userId];

      if (search) {
        whereClause += ' AND (name LIKE ? OR description LIKE ?)';
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern);
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) as count FROM groups ${whereClause}`;
      const countResult = this.db.prepare(countQuery).get(params);
      const total = countResult.count;

      // Get groups
      const groupsQuery = `
        SELECT * FROM groups ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;
      const groupsParams = [...params, limit, offset];
      const rows = this.db.prepare(groupsQuery).all(groupsParams);

      const groups = rows.map(row => Group.fromDatabaseRow(row));

      return {
        groups,
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
      throw new Error(`Failed to find groups with pagination: ${error.message}`);
    }
  }

  /**
   * Generate a unique ID for group
   * @returns {string} - Generated ID
   */
  _generateId() {
    // Generate a random hex string (similar to SQLite's hex(randomblob(16)))
    const bytes = require('crypto').randomBytes(16);
    return bytes.toString('hex').toLowerCase();
  }
}

module.exports = GroupRepository;