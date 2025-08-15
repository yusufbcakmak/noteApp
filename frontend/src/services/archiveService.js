import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add authorization header to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor to handle rate limiting
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'] || 60;
      console.warn(`Rate limit exceeded. Retry after ${retryAfter} seconds.`);
      // You could implement automatic retry logic here if needed
    }
    return Promise.reject(error);
  }
);

// Simple request cache to prevent duplicate requests
const requestCache = new Map();
const CACHE_TTL = 5000; // 5 seconds

const getCacheKey = (method, url, params) => {
  return `${method}:${url}:${JSON.stringify(params || {})}`;
};

const cachedRequest = async (method, url, params, data) => {
  const cacheKey = getCacheKey(method, url, params);
  const now = Date.now();
  
  // Check if we have a recent request for the same data
  if (requestCache.has(cacheKey)) {
    const { timestamp, promise } = requestCache.get(cacheKey);
    if (now - timestamp < CACHE_TTL) {
      return promise;
    }
  }
  
  // Make new request
  let promise;
  if (method === 'GET') {
    promise = api.get(url, { params });
  } else if (method === 'POST') {
    promise = api.post(url, data);
  } else if (method === 'DELETE') {
    promise = api.delete(url);
  }
  
  // Cache the promise
  requestCache.set(cacheKey, { timestamp: now, promise });
  
  // Clean up cache after request completes
  promise.finally(() => {
    setTimeout(() => {
      requestCache.delete(cacheKey);
    }, CACHE_TTL);
  });
  
  return promise;
};

export const archiveService = {
  /**
   * Get all archived notes
   * @param {Object} params - Query parameters
   * @returns {Promise} - API response
   */
  getArchivedNotes: async (params = {}) => {
    const response = await cachedRequest('GET', '/archive', params);
    return response.data;
  },

  /**
   * Archive a completed note (change status to 'archived')
   * @param {string} noteId - Note ID to archive
   * @returns {Promise} - API response
   */
  archiveNote: async (noteId) => {
    const response = await api.post(`/archive/${noteId}`);
    return response.data;
  },

  /**
   * Unarchive a note (change status back to 'done')
   * @param {string} noteId - Note ID to unarchive
   * @returns {Promise} - API response
   */
  unarchiveNote: async (noteId) => {
    const response = await api.post(`/archive/${noteId}/unarchive`);
    return response.data;
  },

  /**
   * Delete an archived note permanently
   * @param {string} noteId - Note ID to delete
   * @returns {Promise} - API response
   */
  deleteArchivedNote: async (noteId) => {
    const response = await api.delete(`/archive/${noteId}`);
    return response.data;
  },

  /**
   * Get archived note statistics
   * @returns {Promise} - API response
   */
  getArchivedNoteStats: async () => {
    const response = await cachedRequest('GET', '/archive/stats');
    return response.data;
  }
};
