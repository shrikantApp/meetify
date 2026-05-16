import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4008/api';

const http = axios.create({ baseURL: API_BASE });

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('meetify_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export const workspaceApi = {
  createWorkspace: async (name: string): Promise<Workspace> => {
    const response = await http.post('/workspaces', { name });
    return response.data;
  },

  getWorkspaces: async (): Promise<Workspace[]> => {
    const response = await http.get('/workspaces');
    return response.data;
  },

  getWorkspaceById: async (id: string): Promise<Workspace> => {
    const response = await http.get(`/workspaces/${id}`);
    return response.data;
  }
};
