// Mock dependencies before importing
jest.mock('../../src/services/HistoryService');

const HistoryController = require('../../src/controllers/HistoryController');
const HistoryService = require('../../src/services/HistoryService');

describe('HistoryController', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      user: { id: 'user-123' },
      query: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('getHistory', () => {
    it('should get history successfully', async () => {
      const mockHistory = [
        { id: 'history-1', title: 'Completed Note 1', completedAt: '2024-01-01T10:00:00Z' },
        { id: 'history-2', title: 'Completed Note 2', completedAt: '2024-01-01T11:00:00Z' }
      ];
      const mockPagination = { page: 1, limit: 10, total: 2, totalPages: 1 };

      HistoryService.getHistory.mockResolvedValue({
        history: mockHistory,
        pagination: mockPagination
      });

      await HistoryController.getHistory(mockReq, mockRes, mockNext);

      expect(HistoryService.getHistory).toHaveBeenCalledWith('user-123', {});
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          history: mockHistory,
          pagination: mockPagination
        }
      });
    });

    it('should handle query parameters', async () => {
      mockReq.query = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        page: '2',
        limit: '5'
      };

      const mockHistory = [];
      const mockPagination = { page: 2, limit: 5, total: 0, totalPages: 0 };

      HistoryService.getHistory.mockResolvedValue({
        history: mockHistory,
        pagination: mockPagination
      });

      await HistoryController.getHistory(mockReq, mockRes, mockNext);

      expect(HistoryService.getHistory).toHaveBeenCalledWith('user-123', {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        page: 2,
        limit: 5
      });
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      HistoryService.getHistory.mockRejectedValue(error);

      await HistoryController.getHistory(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getDailyStats', () => {
    it('should get daily statistics successfully', async () => {
      const mockStats = {
        date: '2024-01-01',
        completedNotes: 5,
        totalNotes: 10,
        completionRate: 0.5,
        priorityBreakdown: {
          high: 2,
          medium: 2,
          low: 1
        }
      };

      HistoryService.getDailyStats.mockResolvedValue(mockStats);

      await HistoryController.getDailyStats(mockReq, mockRes, mockNext);

      expect(HistoryService.getDailyStats).toHaveBeenCalledWith('user-123', {});
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockStats
      });
    });

    it('should handle date parameter', async () => {
      mockReq.query.date = '2024-01-15';

      const mockStats = {
        date: '2024-01-15',
        completedNotes: 3,
        totalNotes: 8,
        completionRate: 0.375
      };

      HistoryService.getDailyStats.mockResolvedValue(mockStats);

      await HistoryController.getDailyStats(mockReq, mockRes, mockNext);

      expect(HistoryService.getDailyStats).toHaveBeenCalledWith('user-123', {
        date: '2024-01-15'
      });
    });

    it('should handle errors', async () => {
      const error = new Error('Service error');
      HistoryService.getDailyStats.mockRejectedValue(error);

      await HistoryController.getDailyStats(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});