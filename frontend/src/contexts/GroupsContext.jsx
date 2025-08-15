import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { groupsService } from '../services/groupsService';

const GroupsContext = createContext();

const groupsReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'SET_GROUPS':
      return { 
        ...state, 
        groups: action.payload, 
        loading: false, 
        error: null 
      };
    case 'ADD_GROUP':
      return { 
        ...state, 
        groups: [...state.groups, action.payload] 
      };
    case 'UPDATE_GROUP':
      return {
        ...state,
        groups: state.groups.map(group => 
          group.id === action.payload.id ? action.payload : group
        )
      };
    case 'DELETE_GROUP':
      return {
        ...state,
        groups: state.groups.filter(group => group.id !== action.payload)
      };
    default:
      return state;
  }
};

const initialState = {
  groups: [],
  loading: false,
  error: null
};

export const GroupsProvider = ({ children }) => {
  const [state, dispatch] = useReducer(groupsReducer, initialState);

  const setLoading = useCallback((loading) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const setError = useCallback((error) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const fetchGroups = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const response = await groupsService.getGroups();
      // Backend returns data as array directly
      const groups = response.data || [];
      dispatch({ type: 'SET_GROUPS', payload: groups });
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || 'Failed to fetch groups';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  }, []);

  const createGroup = useCallback(async (groupData) => {
    try {
      const response = await groupsService.createGroup(groupData);
      const group = response.data;
      dispatch({ type: 'ADD_GROUP', payload: group });
      return group;
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || 'Failed to create group';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      throw error;
    }
  }, []);

  const updateGroup = useCallback(async (id, groupData) => {
    try {
      const response = await groupsService.updateGroup(id, groupData);
      const group = response.data;
      dispatch({ type: 'UPDATE_GROUP', payload: group });
      return group;
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || 'Failed to update group';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      throw error;
    }
  }, []);

  const deleteGroup = useCallback(async (id) => {
    try {
      await groupsService.deleteGroup(id);
      dispatch({ type: 'DELETE_GROUP', payload: id });
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || 'Failed to delete group';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      throw error;
    }
  }, []);

  const value = {
    ...state,
    fetchGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    setLoading,
    setError,
    clearError
  };

  return (
    <GroupsContext.Provider value={value}>
      {children}
    </GroupsContext.Provider>
  );
};

export const useGroups = () => {
  const context = useContext(GroupsContext);
  if (!context) {
    throw new Error('useGroups must be used within a GroupsProvider');
  }
  return context;
};