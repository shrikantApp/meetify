import { createAsyncThunk } from '@reduxjs/toolkit';
import { notificationApi } from '../../services/notificationApi';

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
