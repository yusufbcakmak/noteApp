// Mock dependencies before importing
jest.mock('../../src/repositories/UserRepository');
jest.mock('../../src/repositories/NoteRepository');
jest.mock('../../src/repositories/GroupRepository');
jest.mock('../../src/repositories/CompletedNoteRepository');
jest.mock('bcrypt');

const UserController = require('../../src/controllers/UserController');
const UserRepository = require('../../src/repositories/UserRepository');
const NoteRepository = require('../../src/repositories/NoteRepository');
const GroupRepository = require('../../src/repositories/GroupRepository');
const CompletedNoteRepository = require('../../src/repositories/CompletedNoteRepository');
const bcrypt = require('bcrypt');
const { ValidationError, AuthenticationError, ConflictError } = require('../../src/utils/errors');

describe('UserController', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      user: { id: 'user-123' },
      body: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should get user profile successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        createdAt: '2024-01-01T00:00:00Z'
      };

      UserRepository.findById.mockResolvedValue(mockUser);

      await UserController.getProfile(mockReq, mockRes, mockNext);

      expect(UserRepository.findById).toHaveBeenCalledWith('user-123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { profile: mockUser }
      });
    });

    it('should handle user not found', async () => {
      UserRepository.findById.mockResolvedValue(null);

      await UserController.getProfile(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      UserRepository.findById.mockRejectedValue(error);

      await UserController.getProfile(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully without password change', async () => {
      const updateData = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com'
      };
      const existingUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe'
      };
      const updatedUser = { ...existingUser, ...updateData };

      mockReq.body = updateData;

      UserRepository.findById.mockResolvedValue(existingUser);
      UserRepository.findByEmail.mockResolvedValue(null);
      UserRepository.update.mockResolvedValue(updatedUser);

      await UserController.updateProfile(mockReq, mockRes, mockNext);

      expect(UserRepository.findById).toHaveBeenCalledWith('user-123');
      expect(UserRepository.findByEmail).toHaveBeenCalledWith('jane@example.com');
      expect(UserRepository.update).toHaveBeenCalledWith('user-123', updateData);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Profile updated successfully',
        data: { profile: updatedUser }
      });
    });

    it('should update profile with password change', async () => {
      const updateData = {
        firstName: 'Jane',
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123'
      };
      const existingUser = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashedOldPassword'
      };
      const updatedUser = { ...existingUser, firstName: 'Jane' };

      mockReq.body = updateData;

      UserRepository.findById.mockResolvedValue(existingUser);
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue('hashedNewPassword');
      UserRepository.update.mockResolvedValue(updatedUser);

      await UserController.updateProfile(mockReq, mockRes, mockNext);

      expect(bcrypt.compare).toHaveBeenCalledWith('oldpassword', 'hashedOldPassword');
      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 12);
      expect(UserRepository.update).toHaveBeenCalledWith('user-123', {
        firstName: 'Jane',
        password: 'hashedNewPassword'
      });
    });

    it('should return 400 for invalid current password', async () => {
      const updateData = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123'
      };
      const existingUser = {
        id: 'user-123',
        password: 'hashedOldPassword'
      };

      mockReq.body = updateData;

      UserRepository.findById.mockResolvedValue(existingUser);
      bcrypt.compare.mockResolvedValue(false);

      await UserController.updateProfile(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should return 409 for duplicate email', async () => {
      const updateData = { email: 'existing@example.com' };
      const existingUser = { id: 'user-123', email: 'test@example.com' };
      const duplicateUser = { id: 'other-user', email: 'existing@example.com' };

      mockReq.body = updateData;

      UserRepository.findById.mockResolvedValue(existingUser);
      UserRepository.findByEmail.mockResolvedValue(duplicateUser);

      await UserController.updateProfile(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ConflictError));
    });

    it('should handle user not found', async () => {
      mockReq.body = { firstName: 'Jane' };
      UserRepository.findById.mockResolvedValue(null);

      await UserController.updateProfile(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('deleteAccount', () => {
    it('should delete account successfully', async () => {
      const deleteData = {
        password: 'userpassword',
        confirmation: 'DELETE'
      };
      const existingUser = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashedPassword'
      };

      mockReq.body = deleteData;

      UserRepository.findById.mockResolvedValue(existingUser);
      bcrypt.compare.mockResolvedValue(true);
      CompletedNoteRepository.deleteByUserId.mockResolvedValue();
      NoteRepository.deleteByUserId.mockResolvedValue();
      GroupRepository.deleteByUserId.mockResolvedValue();
      UserRepository.delete.mockResolvedValue(true);

      await UserController.deleteAccount(mockReq, mockRes, mockNext);

      expect(UserRepository.findById).toHaveBeenCalledWith('user-123');
      expect(bcrypt.compare).toHaveBeenCalledWith('userpassword', 'hashedPassword');
      expect(CompletedNoteRepository.deleteByUserId).toHaveBeenCalledWith('user-123');
      expect(NoteRepository.deleteByUserId).toHaveBeenCalledWith('user-123');
      expect(GroupRepository.deleteByUserId).toHaveBeenCalledWith('user-123');
      expect(UserRepository.delete).toHaveBeenCalledWith('user-123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Account deleted successfully'
      });
    });

    it('should return 400 for invalid password', async () => {
      const deleteData = {
        password: 'wrongpassword',
        confirmation: 'DELETE'
      };
      const existingUser = {
        id: 'user-123',
        password: 'hashedPassword'
      };

      mockReq.body = deleteData;

      UserRepository.findById.mockResolvedValue(existingUser);
      bcrypt.compare.mockResolvedValue(false);

      await UserController.deleteAccount(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should return 400 for invalid confirmation', async () => {
      const deleteData = {
        password: 'userpassword',
        confirmation: 'WRONG'
      };
      const existingUser = {
        id: 'user-123',
        password: 'hashedPassword'
      };

      mockReq.body = deleteData;

      UserRepository.findById.mockResolvedValue(existingUser);
      bcrypt.compare.mockResolvedValue(true);

      await UserController.deleteAccount(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('should handle user not found', async () => {
      mockReq.body = { password: 'password', confirmation: 'DELETE' };
      UserRepository.findById.mockResolvedValue(null);

      await UserController.deleteAccount(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});