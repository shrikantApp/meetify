import { createAsyncThunk } from '@reduxjs/toolkit';
import { notificationApi } from '../../services/notificationApi';
import { chatApi } from '../../services/chatApi';

export const fetchNotifications = createAsyncThunk('notifications/fetch', async () => {
  return notificationApi.list('all');
});

export const fetchUnreadCount = createAsyncThunk('notifications/unreadCount', async () => {
  return notificationApi.unreadCount();
});

export const markNotificationsRead = createAsyncThunk(
  'notifications/markRead',
  async (notificationIds?: string[]) => notificationApi.markRead(notificationIds),
);

export const acceptDirectChatRequest = createAsyncThunk(
  'notifications/acceptDirectChatRequest',
  async (conversationId: string) => chatApi.acceptConversationRequest(conversationId),
);

export const rejectDirectChatRequest = createAsyncThunk(
  'notifications/rejectDirectChatRequest',
  async (conversationId: string) => chatApi.rejectConversationRequest(conversationId),
);
