import api from './authService';

export const groupsService = {
  async getGroups() {
    const response = await api.get('/groups');
    return response.data;
  },

  async createGroup(groupData) {
    const response = await api.post('/groups', groupData);
    return response.data;
  },

  async updateGroup(id, groupData) {
    const response = await api.put(`/groups/${id}`, groupData);
    return response.data;
  },

  async deleteGroup(id) {
    const response = await api.delete(`/groups/${id}`);
    return response.data;
  }
};