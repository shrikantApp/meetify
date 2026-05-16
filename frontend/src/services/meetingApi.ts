import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4008/api';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('meetify_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const meetingApi = {
  createMeeting: async (title: string, description?: string) => {
    const response = await api.post('/meetings', { title, description });
    return response.data;
  },
  getMeetingByCode: async (code: string) => {
    const response = await api.get(`/meetings/${code}`);
    return response.data;
  },
};
