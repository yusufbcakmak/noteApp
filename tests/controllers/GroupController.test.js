// Mock dependencies before importing
jest.mock('../../src/repositories/GroupRepository');
jest.mock('../../src/repositories/NoteRepository');

const GroupController = require('../../src/controllers/GroupController');
const GroupRepository = require('../../src/repositories/GroupRepository');
const NoteRepository = require('../../src/repositories/NoteRepository');
const { ValidationError, NotFoundError, ConflictError } = require('../../src/utils/errors');

describe('GroupController', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      user: { id: 'user-123' },
      params: {},
      query: {},
      body: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('getAllGroups', () => {
    it('should get all groups successfully', async () => {
      const mockGroups = [
        { id: 'group-1', name: 'Work', userId: 'user-123' },
        { id: 'group-2', name: 'Personal', userId: 'user-123' }
      ];

      GroupRepository.findByUserId.mockResolvedValue(mockGroups);

      await GroupController.getAllGroups(mockReq, mockRes, mockNext);

      expect(GroupRepository.findByUserId).toHaveBeenCalledWith('user-123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { groups: mockGroups }
      });
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      GroupRepository.findByUserId.mockRejectedValue(error);

      await GroupController.getAllGroups(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getGroupById', () => {
    it('should get group by id successfully', async () => {
      const mockGroup = { id: 'group-1', name: 'Work', userId: 'user-123' };
      mockReq.params.id = 'group-1';

      GroupRepository.findById.mockResolvedValue(mockGroup);

      await GroupController.getGroupById(mockReq, mockRes, mockNext);

      expect(GroupRepository.findById).toHaveBeenCalledWith('group-1');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockGroup
      });
    });

    it('should return 404 for non-existent group', async () => {
      mockReq.params.id = 'non-existent';
      GroupRepository.findById.mockResolvedValue(null);

      await GroupController.getGroupById(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
    });

    it('should return 404 for group belonging to different user', async () => {
      const mockGroup = { id: 'group-1', name: 'Work', userId: 'other-user' };
      mockReq.params.id = 'group-1';

      GroupRepository.findById.mockResolvedValue(mockGroup);

      await GroupController.getGroupById(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
    });
  });

  describe('createGroup', () => {
    it('should create group successfully', async () => {
      const groupData = {
        name: 'New Group',
        description: 'Group description',
        color: '#3498db'
      };
      const mockGroup = { id: 'group-1', ...groupData, userId: 'user-123' };

      mockReq.body = groupData;
      GroupRepository.findByNameAndUserId.mockResolvedValue(null);
      GroupRepository.create.mockResolvedValue(mockGroup);

      await GroupController.createGroup(mockReq, mockRes, mockNext);

      expect(GroupRepository.findByNameAndUserId).toHaveBeenCalledWith('New Group', 'user-123');
      expect(GroupRepository.create).toHaveBeenCalledWith({
        ...groupData,
        userId: 'user-123'
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Group created successfully',
        data: mockGroup
      });
    });

    it('should return 409 for duplicate group name', async () => {
      const groupData = { name: 'Existing Group' };
      const existingGroup = { id: 'group-1', name: 'Existing Group', userId: 'user-123' };

      mockReq.body = groupData;
      GroupRepository.findByNameAndUserId.mockResolvedValue(existingGroup);

      await GroupController.createGroup(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ConflictError));
    });

    it('should handle creation errors', async () => {
      const error = new ValidationError('Name is required');
      GroupRepository.findByNameAndUserId.mockResolvedValue(null);
      GroupRepository.create.mockRejectedValue(error);

      mockReq.body = { description: 'No name' };

      await GroupController.createGroup(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('updateGroup', () => {
    it('should update group successfully', async () => {
      const updateData = { name: 'Updated Group', description: 'Updated description' };
      const existingGroup = { id: 'group-1', name: 'Old Group', userId: 'user-123' };
      const updatedGroup = { ...existingGroup, ...updateData };

      mockReq.params.id = 'group-1';
      mockReq.body = updateData;

      GroupRepository.findById.mockResolvedValue(existingGroup);
      GroupRepository.findByNameAndUserId.mockResolvedValue(null);
      GroupRepository.update.mockResolvedValue(updatedGroup);

      await GroupController.updateGroup(mockReq, mockRes, mockNext);

      expect(GroupRepository.findById).toHaveBeenCalledWith('group-1');
      expect(GroupRepository.findByNameAndUserId).toHaveBeenCalledWith('Updated Group', 'user-123');
      expect(GroupRepository.update).toHaveBeenCalledWith('group-1', updateData);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Group updated successfully',
        data: updatedGroup
      });
    });

    it('should return 404 for non-existent group', async () => {
      mockReq.params.id = 'non-existent';
      mockReq.body = { name: 'Updated' };

      GroupRepository.findById.mockResolvedValue(null);

      await GroupController.updateGroup(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
    });

    it('should return 409 for duplicate name', async () => {
      const updateData = { name: 'Existing Group' };
      const existingGroup = { id: 'group-1', name: 'Old Group', userId: 'user-123' };
      const duplicateGroup = { id: 'group-2', name: 'Existing Group', userId: 'user-123' };

      mockReq.params.id = 'group-1';
      mockReq.body = updateData;

      GroupRepository.findById.mockResolvedValue(existingGroup);
      GroupRepository.findByNameAndUserId.mockResolvedValue(duplicateGroup);

      await GroupController.updateGroup(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ConflictError));
    });
  });

  describe('deleteGroup', () => {
    it('should delete group successfully', async () => {
      const existingGroup = { id: 'group-1', name: 'Test Group', userId: 'user-123' };

      mockReq.params.id = 'group-1';
      GroupRepository.findById.mockResolvedValue(existingGroup);
      NoteRepository.updateGroupToNull.mockResolvedValue();
      GroupRepository.delete.mockResolvedValue(true);

      await GroupController.deleteGroup(mockReq, mockRes, mockNext);

      expect(GroupRepository.findById).toHaveBeenCalledWith('group-1');
      expect(NoteRepository.updateGroupToNull).toHaveBeenCalledWith('group-1');
      expect(GroupRepository.delete).toHaveBeenCalledWith('group-1');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Group deleted successfully'
      });
    });

    it('should return 404 for non-existent group', async () => {
      mockReq.params.id = 'non-existent';
      GroupRepository.findById.mockResolvedValue(null);

      await GroupController.deleteGroup(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
    });
  });

  describe('getGroupStats', () => {
    it('should get group statistics successfully', async () => {
      const mockStats = {
        totalGroups: 5,
        groupsWithNotes: 3,
        averageNotesPerGroup: 2.5
      };

      GroupRepository.getStatsByUserId.mockResolvedValue(mockStats);

      await GroupController.getGroupStats(mockReq, mockRes, mockNext);

      expect(GroupRepository.getStatsByUserId).toHaveBeenCalledWith('user-123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockStats
      });
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      GroupRepository.getStatsByUserId.mockRejectedValue(error);

      await GroupController.getGroupStats(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});