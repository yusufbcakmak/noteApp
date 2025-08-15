import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { historyService } from '../services/historyService';

const HistoryContext = createContext();

const historyReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'SET_HISTORY':
      return { 
        ...state, 
        completedNotes: action.payload, 
        loading: false, 
        error: null 
      };
    case 'SET_DAILY_STATS':
      return { 
        ...state, 
        dailyStats: action.payload, 
        loading: false, 
        error: null 
      };
    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload } };
    default:
      return state;
  }
};

const initialState = {
  completedNotes: [],
  dailyStats: [],
  loading: false,
  error: null,
  filters: {
    startDate: null,
    endDate: null
  }
};

export const HistoryProvider = ({ children }) => {
  const [state, dispatch] = useReducer(historyReducer, initialState);

  const setLoading = useCallback((loading) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const setError = useCallback((error) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const fetchHistory = useCallback(async (filters = {}) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const response = await historyService.getHistory(filters);
      dispatch({ type: 'SET_HISTORY', payload: response.data?.completedNotes || [] });
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || 'Failed to fetch history';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  }, []);

  const fetchDailyStats = useCallback(async (filters = {}) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const response = await historyService.getDailyStats(filters);
      dispatch({ type: 'SET_DAILY_STATS', payload: response.data?.dailyStats || [] });
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || 'Failed to fetch daily stats';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  }, []);

  const setFilters = useCallback((filters) => {
    dispatch({ type: 'SET_FILTERS', payload: filters });
  }, []);

  const value = {
    ...state,
    fetchHistory,
    fetchDailyStats,
    setFilters,
    setLoading,
    setError,
    clearError
  };

  return (
    <HistoryContext.Provider value={value}>
      {children}
    </HistoryContext.Provider>
  );
};

export const useHistory = () => {
  const context = useContext(HistoryContext);
  if (!context) {
    throw new Error('useHistory must be used within a HistoryProvider');
  }
  return context;
};