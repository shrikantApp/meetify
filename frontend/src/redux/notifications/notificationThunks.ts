import { createAsyncThunk } from '@reduxjs/toolkit';
import { notificationApi } from '../../services/notificationApi';
import { chatApi } from '../../services/chatApi';

export const fetchNotifications = createAsyncThunk('notifications/fetch', async () => {
  // We only show actionable/unread items in the bell by default.
  // Read items are still available via API if we add a "view all" later.
  return notificationApi.list('unread');
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
