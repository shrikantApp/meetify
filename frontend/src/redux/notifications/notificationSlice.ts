import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { NotificationItem } from '../../services/notificationApi';
import { fetchNotifications, fetchUnreadCount, markNotificationsRead } from './notificationThunks';

interface NotificationsState {
  items: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
}

const initialState: NotificationsState = {
  items: [],
  unreadCount: 0,
  loading: false,
  error: null,
};

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    upsertNotification(state, action: PayloadAction<NotificationItem>) {
      const existing = state.items.findIndex((item) => item.id === action.payload.id);
      if (existing >= 0) state.items[existing] = action.payload;
      else state.items.unshift(action.payload);
      state.unreadCount = state.items.filter((item) => !item.isRead).length;
    },
    setUnreadCount(state, action: PayloadAction<number>) {
      state.unreadCount = action.payload;
    },
    markLocalRead(state, action: PayloadAction<{ notificationIds?: string[]; all?: boolean }>) {
      if (action.payload.all) {
        state.items.forEach((item) => { item.isRead = true; });
      } else {
        const ids = new Set(action.payload.notificationIds ?? []);
        state.items.forEach((item) => { if (ids.has(item.id)) item.isRead = true; });
      }
      state.unreadCount = state.items.filter((item) => !item.isRead).length;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items;
        state.unreadCount = action.payload.items.filter((item) => !item.isRead).length;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load notifications';
      })
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        state.unreadCount = action.payload.count;
      })
      .addCase(markNotificationsRead.fulfilled, (state, action) => {
        state.unreadCount = action.payload.unreadCount;
      });
  },
});

export const { upsertNotification, setUnreadCount, markLocalRead } = notificationSlice.actions;
export default notificationSlice.reducer;
