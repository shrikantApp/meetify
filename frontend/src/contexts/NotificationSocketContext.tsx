import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAppDispatch, useAppSelector } from '../redux/store';
import { fetchNotifications, fetchUnreadCount } from '../redux/notifications/notificationThunks';
import { markLocalRead, setUnreadCount, upsertNotification } from '../redux/notifications/notificationSlice';
import type { NotificationItem } from '../services/notificationApi';
import { fetchConversations } from '../redux/chat/chatThunks';

const SOCKET_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '/notifications')
  : 'http://localhost:4008/notifications';

const NotificationSocketContext = createContext<{ socket: Socket | null; isConnected: boolean }>({
  socket: null,
  isConnected: false,
});

export function NotificationSocketProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.currentUser.access_token);
  const userId = useAppSelector((state) => state.auth.userProfile?.id);
  const activeWorkspaceId = useAppSelector((state) => state.workspace.activeWorkspaceId);
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token || !userId) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      return;
    }
    if (socketRef.current) return;
    const socket = io(SOCKET_URL, { auth: { token }, reconnectionAttempts: Infinity });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      dispatch(fetchNotifications());
      dispatch(fetchUnreadCount());
    });
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('notification.created', (notification: NotificationItem) => {
      dispatch(upsertNotification(notification));
      if (
        notification.type === 'group_invite' ||
        notification.type === 'direct_chat_request'
      ) {
        dispatch(fetchConversations(activeWorkspaceId ?? undefined));
      }
    });
    socket.on('notification.read', (payload: { notificationIds?: string[]; all?: boolean }) => dispatch(markLocalRead(payload)));
    socket.on('notification.unread_count.updated', ({ count }: { count: number }) => dispatch(setUnreadCount(count)));

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [activeWorkspaceId, dispatch, token, userId]);

  return (
    <NotificationSocketContext.Provider value={{ socket: socketRef.current, isConnected }}>
      {children}
    </NotificationSocketContext.Provider>
  );
}

export const useNotificationSocket = () => useContext(NotificationSocketContext);
