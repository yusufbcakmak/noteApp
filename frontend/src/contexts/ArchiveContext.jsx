import React, { createContext, useContext, useReducer, useCallback, useRef } from 'react';
import { archiveService } from '../services/archiveService';

// Debounce utility
const useDebounce = (callback, delay) => {
  const timeoutRef = useRef(null);
  
  return useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
};

const ArchiveContext = createContext();

const archiveReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'SET_ARCHIVED_NOTES':
      return { 
        ...state, 
        archivedNotes: action.payload, 
        loading: false, 
        error: null 
      };
    case 'ADD_ARCHIVED_NOTE':
      return { 
        ...state, 
        archivedNotes: [...state.archivedNotes, action.payload] 
      };
    case 'DELETE_ARCHIVED_NOTE':
      return {
        ...state,
        archivedNotes: state.archivedNotes.filter(note => note.id !== action.payload)
      };
    case 'UNARCHIVE_NOTE':
      return {
        ...state,
        archivedNotes: state.archivedNotes.filter(note => note.id !== action.payload)
      };
    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload } };
    case 'SET_PAGINATION':
      return { ...state, pagination: action.payload };
    case 'SET_STATS':
      return { ...state, stats: action.payload };
    default:
      return state;
  }
};

const initialState = {
  archivedNotes: [],
  loading: false,
  error: null,
  filters: {
    priority: null,
    groupName: null,
    search: ''
  },
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  },
  stats: {
    priorityCounts: { low: 0, medium: 0, high: 0, total: 0 },
    groupCounts: { total: 0 }
  }
};

export const ArchiveProvider = ({ children }) => {
  const [state, dispatch] = useReducer(archiveReducer, initialState);

  const setLoading = useCallback((loading) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const setError = useCallback((error) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const fetchArchivedNotes = useCallback(async (filters = {}, page = 1) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const params = {
        ...filters,
        page,
        limit: state.pagination.limit
      };
      
      const response = await archiveService.getArchivedNotes(params);
      const archivedNotes = response.data?.items || response.data || [];
      const pagination = response.data?.pagination || state.pagination;
      
      dispatch({ type: 'SET_ARCHIVED_NOTES', payload: archivedNotes });
      dispatch({ type: 'SET_PAGINATION', payload: pagination });
    } catch (error) {
      if (error.response?.status === 429) {
        const errorMessage = 'Too many requests. Please wait a moment before trying again.';
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
      } else {
        const errorMessage = error.response?.data?.error?.message || 'Failed to fetch archived notes';
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
      }
    }
  }, [state.pagination.limit]);

  // Debounced version of fetchArchivedNotes
  const debouncedFetchArchivedNotes = useDebounce(fetchArchivedNotes, 300);

  const archiveNote = useCallback(async (noteId) => {
    try {
      const response = await archiveService.archiveNote(noteId);
      // Since we're using single-table approach, response.data is the updated note
      // No need to add to archived notes list here - we'll handle in fetchArchivedNotes
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || 'Failed to archive note';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      throw error;
    }
  }, []);

  const unarchiveNote = useCallback(async (noteId) => {
    try {
      const response = await archiveService.unarchiveNote(noteId);
      const restoredNote = response.data;
      dispatch({ type: 'UNARCHIVE_NOTE', payload: noteId });
      return restoredNote;
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || 'Failed to unarchive note';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      throw error;
    }
  }, []);

  const deleteArchivedNote = useCallback(async (noteId) => {
    try {
      await archiveService.deleteArchivedNote(noteId);
      dispatch({ type: 'DELETE_ARCHIVED_NOTE', payload: noteId });
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || 'Failed to delete archived note';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      throw error;
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const response = await archiveService.getArchivedNoteStats();
      dispatch({ type: 'SET_STATS', payload: response.data });
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || 'Failed to fetch archive statistics';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  }, []);

  const setFilters = useCallback((filters) => {
    dispatch({ type: 'SET_FILTERS', payload: filters });
  }, []);

  const changePage = useCallback((newPage) => {
    dispatch({ type: 'SET_PAGINATION', payload: { ...state.pagination, page: newPage } });
  }, [state.pagination]);

  const value = {
    ...state,
    fetchArchivedNotes: debouncedFetchArchivedNotes,
    archiveNote,
    unarchiveNote,
    deleteArchivedNote,
    fetchStats,
    setFilters,
    changePage,
    setLoading,
    setError,
    clearError
  };

  return (
    <ArchiveContext.Provider value={value}>
      {children}
    </ArchiveContext.Provider>
  );
};

export const useArchive = () => {
  const context = useContext(ArchiveContext);
  if (!context) {
    throw new Error('useArchive must be used within an ArchiveProvider');
  }
  return context;
};
