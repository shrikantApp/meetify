import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4008/api';

const http = axios.create({ baseURL: API_BASE });

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('meetify_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const getUploadAuthHeaders = () => {
  const token = localStorage.getItem('meetify_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const chatApi = {
  // Conversations
  getConversations: (workspaceId?: string) =>
    http.get('/chat/conversations', { params: workspaceId ? { workspaceId } : undefined }).then((r) => r.data),

  getConversation: (id: string) =>
    http.get(`/chat/conversations/${id}`).then((r) => r.data),

  createConversation: (body: {
    type: string;
    targetUserId?: string;
    name?: string;
    description?: string;
    memberIds?: string[];
    avatarUrl?: string;
    workspaceId?: string;
  }) => http.post('/chat/conversations', body).then((r) => r.data),

  acceptConversationRequest: (id: string) =>
    http.post(`/chat/conversations/${id}/accept`).then((r) => r.data),

  rejectConversationRequest: (id: string) =>
    http.post(`/chat/conversations/${id}/reject`).then((r) => r.data),

  muteConversation: (id: string, isMuted: boolean) =>
    http.patch(`/chat/conversations/${id}/mute`, { isMuted }).then((r) => r.data),

  archiveConversation: (id: string, isArchived: boolean) =>
    http.patch(`/chat/conversations/${id}/archive`, { isArchived }).then((r) => r.data),

  addMember: (conversationId: string, userId: string) =>
    http.post(`/chat/conversations/${conversationId}/members`, { userId }).then((r) => r.data),

  removeMember: (conversationId: string, userId: string) =>
    http.delete(`/chat/conversations/${conversationId}/members/${userId}`).then((r) => r.data),

  // Messages
  getMessages: (conversationId: string, params?: { cursor?: string; limit?: number }) =>
    http.get(`/chat/conversations/${conversationId}/messages`, { params }).then((r) => r.data),

  sendMessage: (
    conversationId: string,
    body: { content?: string; type?: string; replyToId?: string; tempId?: string },
  ) => http.post(`/chat/conversations/${conversationId}/messages`, body).then((r) => r.data),

  editMessage: (messageId: string, content: string) =>
    http.patch(`/chat/messages/${messageId}`, { content }).then((r) => r.data),

  deleteMessage: (messageId: string, forEveryone = false) =>
    http.delete(`/chat/messages/${messageId}`, { params: { forEveryone } }).then((r) => r.data),

  markRead: (messageId: string, conversationId: string) =>
    http.post(`/chat/messages/${messageId}/read`, { conversationId }).then((r) => r.data),

  reactToMessage: (messageId: string, conversationId: string, emoji: string) =>
    http.post(`/chat/messages/${messageId}/react`, { conversationId, emoji }).then((r) => r.data),

  searchMessages: (conversationId: string, q: string) =>
    http.get(`/chat/conversations/${conversationId}/search`, { params: { q } }).then((r) => r.data),

  getMessageStatus: (messageId: string) =>
    http.get(`/chat/messages/${messageId}/status`).then((r) => r.data),

  // Users
  searchUsers: (q: string) =>
    http.get('/users/search', { params: { q } }).then((r) => r.data),

  // Presence
  getPresence: (userIds: string[]) =>
    http.get('/chat/presence', { params: { userIds: userIds.join(',') } }).then((r) => r.data),

  // Uploads
  getPresignedUrl: (fileName: string, mimeType: string) =>
    http.post('/uploads/presigned', { fileName, mimeType }).then((r) => r.data),

  uploadFileToMinio: async (url: string, file: File) => {
    if (url.includes('/api/uploads/local/')) {
      const formData = new FormData();
      formData.append('file', file);
      return axios.post(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...getUploadAuthHeaders(),
        },
      });
    }
    return axios.put(url, file, {
      headers: {
        'Content-Type': file.type,
      },
    });
  },
};
