import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { notesService } from '../services/notesService';

const NotesContext = createContext();

const notesReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'SET_NOTES':
      return { 
        ...state, 
        notes: action.payload, 
        loading: false, 
        error: null 
      };
    case 'ADD_NOTE':
      return { 
        ...state, 
        notes: [...state.notes, action.payload] 
      };
    case 'UPDATE_NOTE':
      return {
        ...state,
        notes: state.notes.map(note => 
          note.id === action.payload.id ? action.payload : note
        )
      };
    case 'ARCHIVE_NOTE':
      return {
        ...state,
        notes: state.notes.filter(note => note.id !== action.payload)
      };
    case 'DELETE_NOTE':
      return {
        ...state,
        notes: state.notes.filter(note => note.id !== action.payload)
      };
    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload } };
    default:
      return state;
  }
};

const initialState = {
  notes: [],
  loading: false,
  error: null,
  filters: {
    status: null,
    priority: null,
    groupId: null
  }
};

export const NotesProvider = ({ children }) => {
  const [state, dispatch] = useReducer(notesReducer, initialState);

  const setLoading = useCallback((loading) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const setError = useCallback((error) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const fetchNotes = useCallback(async (filters = {}) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const response = await notesService.getNotes(filters);
      // Backend returns data.items for paginated results or just data for non-paginated
      const notes = response.data?.items || response.data || [];
      dispatch({ type: 'SET_NOTES', payload: notes });
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || 'Failed to fetch notes';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  }, []);

  const createNote = useCallback(async (noteData) => {
    try {
      const response = await notesService.createNote(noteData);
      const note = response.data;
      dispatch({ type: 'ADD_NOTE', payload: note });
      return note;
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || 'Failed to create note';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      throw error;
    }
  }, []);

  const updateNote = useCallback(async (id, noteData) => {
    try {
      const response = await notesService.updateNote(id, noteData);
      const note = response.data;
      dispatch({ type: 'UPDATE_NOTE', payload: note });
      return note;
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || 'Failed to update note';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      throw error;
    }
  }, []);

  const deleteNote = useCallback(async (id) => {
    try {
      await notesService.deleteNote(id);
      dispatch({ type: 'DELETE_NOTE', payload: id });
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || 'Failed to delete note';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      throw error;
    }
  }, []);

  const updateNoteStatus = useCallback(async (id, status) => {
    try {
      const response = await notesService.updateNoteStatus(id, status);
      const note = response.data;
      dispatch({ type: 'UPDATE_NOTE', payload: note });
      return note;
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || 'Failed to update note status';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      throw error;
    }
  }, []);

  const addNote = useCallback(async (note) => {
    dispatch({ type: 'ADD_NOTE', payload: note });
  }, []);

  const removeArchivedNote = useCallback(async (noteId) => {
    dispatch({ type: 'ARCHIVE_NOTE', payload: noteId });
  }, []);

  const setFilters = useCallback((filters) => {
    dispatch({ type: 'SET_FILTERS', payload: filters });
  }, []);

  const value = {
    ...state,
    fetchNotes,
    createNote,
    updateNote,
    deleteNote,
    updateNoteStatus,
    addNote,
    removeArchivedNote,
    setFilters,
    setLoading,
    setError,
    clearError
  };

  return (
    <NotesContext.Provider value={value}>
      {children}
    </NotesContext.Provider>
  );
};

export const useNotes = () => {
  const context = useContext(NotesContext);
  if (!context) {
    throw new Error('useNotes must be used within a NotesProvider');
  }
  return context;
};