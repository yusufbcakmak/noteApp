import axios from 'axios';

// For Netlify deployment, API endpoints will be available at /.netlify/functions/api
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.PROD ? '/api' : 'http://localhost:3000/api');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authService = {
  async login(email, password) {
    const response = await api.post('/auth/login', { email, password });
    const { data } = response.data;
    const { user, tokens } = data;
    
    // Store access token in localStorage
    if (tokens?.accessToken) {
      localStorage.setItem('token', tokens.accessToken);
    }
    
    return { token: tokens?.accessToken, user };
  },

  async register(userData) {
    const response = await api.post('/auth/register', userData);
    const { data } = response.data;
    const { user, tokens } = data;
    
    // Store access token in localStorage
    if (tokens?.accessToken) {
      localStorage.setItem('token', tokens.accessToken);
    }
    
    return { token: tokens?.accessToken, user };
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // Continue with logout even if API call fails
      console.error('Logout API call failed');
    }
    
    // Always remove token from localStorage
    localStorage.removeItem('token');
  },

  async verifyToken(token) {
    const response = await api.get('/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data.data?.user;
  },

  async forgotPassword(email) {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  async resetPassword(token, password) {
    const response = await api.post('/auth/reset-password', { token, password });
    return response.data;
  },

  // Token management utilities
  getToken() {
    return localStorage.getItem('token');
  },

  setToken(token) {
    localStorage.setItem('token', token);
  },

  removeToken() {
    localStorage.removeItem('token');
  },

  isTokenExpired(token) {
    if (!token) return true;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      return payload.exp < currentTime;
    } catch {
      return true;
    }
  }
};

export default api;