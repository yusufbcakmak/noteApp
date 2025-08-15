import api from './authService';

export const notesService = {
  async getNotes(filters = {}) {
    const params = new URLSearchParams();
    
    if (filters.status) params.append('status', filters.status);
    if (filters.priority) params.append('priority', filters.priority);
    if (filters.groupId) params.append('groupId', filters.groupId);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    
    const response = await api.get(`/notes?${params.toString()}`);
    return response.data;
  },

  async createNote(noteData) {
    const response = await api.post('/notes', noteData);
    return response.data;
  },

  async updateNote(id, noteData) {
    const response = await api.put(`/notes/${id}`, noteData);
    return response.data;
  },

  async deleteNote(id) {
    const response = await api.delete(`/notes/${id}`);
    return response.data;
  },

  async updateNoteStatus(id, status) {
    const response = await api.patch(`/notes/${id}/status`, { status });
    return response.data;
  }
};