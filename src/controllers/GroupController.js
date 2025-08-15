const Group = require('../models/Group');
const GroupRepository = require('../repositories/GroupRepository');

/**
 * Group controller for handling group-related HTTP requests
 */
class GroupController {
  constructor() {
    this.groupRepository = null;
  }

  /**
   * Initialize controller with database connection
   */
  init() {
    this.groupRepository = new GroupRepository().init();
    return this;
  }

  /**
   * Get all groups for the authenticated user
   * GET /api/groups
   */
  getGroups = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const {
        page,
        limit,
        search,
        sortBy = 'created_at',
        sortOrder = 'DESC',
        includeNoteCounts = 'false'
      } = req.query;

      let result;

      if (page && limit) {
        // Paginated request
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit))); // Max 100 items per page

        const options = {
          page: pageNum,
          limit: limitNum,
          search,
          sortBy,
          sortOrder
        };

        result = await this.groupRepository.findWithPagination(userId, options);
        
        res.json({
          success: true,
          data: {
            items: result.groups.map(group => group.toJSON()),
            pagination: result.pagination
          },
          timestamp: new Date().toISOString()
        });
      } else if (search) {
        // Non-paginated request with search - use pagination with high limit
        const options = {
          page: 1,
          limit: 1000, // High limit to get all results
          search,
          sortBy,
          sortOrder
        };

        result = await this.groupRepository.findWithPagination(userId, options);
        
        res.json({
          success: true,
          data: result.groups.map(group => group.toJSON()),
          timestamp: new Date().toISOString()
        });
      } else {
        // Non-paginated request without search
        if (includeNoteCounts === 'true') {
          const groups = await this.groupRepository.findWithNoteCounts(userId);
          res.json({
            success: true,
            data: groups,
            timestamp: new Date().toISOString()
          });
        } else {
          const options = { orderBy: sortBy, orderDirection: sortOrder };
          const groups = await this.groupRepository.findByUserId(userId, options);
          res.json({
            success: true,
            data: groups.map(group => group.toJSON()),
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get a specific group by ID
   * GET /api/groups/:id
   */
  getGroupById = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const group = await this.groupRepository.findByIdAndUserId(id, userId);

      if (!group) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'GROUP_NOT_FOUND',
            message: 'Group not found'
          },
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        data: group.toJSON(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create a new group
   * POST /api/groups
   */
  createGroup = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const groupData = { 
        ...req.body, 
        userId,
        color: req.body.color || '#3498db'
      };

      // Check if group name already exists for this user
      const existingGroup = await this.groupRepository.findByNameAndUserId(groupData.name, userId);
      if (existingGroup) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'GROUP_NAME_EXISTS',
            message: 'A group with this name already exists'
          },
          timestamp: new Date().toISOString()
        });
      }

      const group = await this.groupRepository.create(groupData);

      res.status(201).json({
        success: true,
        data: group.toJSON(),
        message: 'Group created successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update an existing group
   * PUT /api/groups/:id
   */
  updateGroup = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Check if group exists and belongs to user
      const existingGroup = await this.groupRepository.findByIdAndUserId(id, userId);
      if (!existingGroup) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'GROUP_NOT_FOUND',
            message: 'Group not found'
          },
          timestamp: new Date().toISOString()
        });
      }

      // Check if new name already exists for this user (excluding current group)
      if (req.body.name && req.body.name !== existingGroup.name) {
        const nameExists = await this.groupRepository.nameExistsForUser(req.body.name, userId, id);
        if (nameExists) {
          return res.status(409).json({
            success: false,
            error: {
              code: 'GROUP_NAME_EXISTS',
              message: 'A group with this name already exists'
            },
            timestamp: new Date().toISOString()
          });
        }
      }

      const updatedGroup = await this.groupRepository.update(id, req.body);

      res.json({
        success: true,
        data: updatedGroup.toJSON(),
        message: 'Group updated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete a group
   * DELETE /api/groups/:id
   */
  deleteGroup = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { reassignNotes = 'true' } = req.query;

      // Check if group exists and belongs to user
      const existingGroup = await this.groupRepository.findByIdAndUserId(id, userId);
      if (!existingGroup) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'GROUP_NOT_FOUND',
            message: 'Group not found'
          },
          timestamp: new Date().toISOString()
        });
      }

      let deleteResult;
      if (reassignNotes === 'true') {
        // Delete group and reassign notes to ungrouped (null)
        deleteResult = await this.groupRepository.deleteAndReassignNotes(id);
      } else {
        // Simple delete (notes will be handled by foreign key constraint)
        deleteResult = await this.groupRepository.delete(id);
      }

      if (!deleteResult) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'DELETE_FAILED',
            message: 'Failed to delete group'
          },
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        message: 'Group deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get group statistics
   * GET /api/groups/stats
   */
  getGroupStats = async (req, res, next) => {
    try {
      const userId = req.user.id;

      const totalGroups = await this.groupRepository.getCountByUserId(userId);
      const groupsWithCounts = await this.groupRepository.findWithNoteCounts(userId);
      
      const totalNotes = groupsWithCounts.reduce((sum, group) => sum + group.noteCount, 0);
      const averageNotesPerGroup = totalGroups > 0 ? Math.round(totalNotes / totalGroups * 100) / 100 : 0;

      res.json({
        success: true,
        data: {
          totalGroups,
          totalNotes,
          averageNotesPerGroup,
          groupsWithCounts: groupsWithCounts.map(group => ({
            id: group.id,
            name: group.name,
            color: group.color,
            noteCount: group.noteCount
          }))
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = GroupController;