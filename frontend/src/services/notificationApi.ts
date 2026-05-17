import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4008/api';
const http = axios.create({ baseURL: API_BASE });

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('meetify_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  body?: string;
  referenceId?: string;
  referenceType?: string;
  isRead: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
}

export const notificationApi = {
  list: async (status: 'all' | 'read' | 'unread' = 'all') => {
    const response = await http.get('/notifications', { params: { status, page: 1, limit: 30 } });
    return response.data as { items: NotificationItem[]; total: number; hasMore: boolean };
  },
  unreadCount: async () => {
    const response = await http.get('/notifications/unread-count');
    return response.data as { count: number };
  },
  markRead: async (notificationIds?: string[]) => {
    const response = await http.patch('/notifications/read', { notificationIds });
    return response.data as { success: boolean; unreadCount: number };
  },
  markOneRead: async (id: string) => {
    const response = await http.patch(`/notifications/${id}/read`);
    return response.data as NotificationItem;
  },
  markOneUnread: async (id: string) => {
    const response = await http.patch(`/notifications/${id}/unread`);
    return response.data as NotificationItem;
  },
};
