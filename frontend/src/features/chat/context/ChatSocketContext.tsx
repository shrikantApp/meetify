import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAppDispatch, useAppSelector } from '../../../redux/store';
import { useMessageQueue } from '../../../hooks/useMessageQueue';
import {
  setSocketStatus,
  addMessage,
  confirmMessage,
  updateMessageStatus,
  markConversationRead,
  deleteMessage,
  updateReactions,
  setTyping,
  updatePresence,
} from '../../../redux/chat/chatSlice';
import { editMessage } from '../../../redux/chat/chatThunks';

interface ChatSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  emit: (event: string, data: any) => void;
}

const ChatSocketContext = createContext<ChatSocketContextType | undefined>(undefined);

const CHAT_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '/chat')
  : 'http://localhost:4008/chat';

export const ChatSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useAppDispatch();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { queue, dequeue, incrementRetry } = useMessageQueue();

  const token = useAppSelector((state) => state.auth.currentUser.access_token);
  const activeConversationId = useAppSelector((state) => state.chat.activeConversationId);
  const currentUser = useAppSelector((state) => state.auth.userProfile);
  const allMessages = useAppSelector((state) => state.chat.messages);

  const activeConvIdRef = useRef(activeConversationId);
  const currentUserRef = useRef(currentUser);

  useEffect(() => { activeConvIdRef.current = activeConversationId; }, [activeConversationId]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  // Auto-mark as read when conversation becomes active
  useEffect(() => {
    if (socketRef.current?.connected && activeConversationId && currentUser) {
      const messages = allMessages[activeConversationId] || [];
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.senderId !== currentUser.id) {
        socketRef.current.emit('message_read', {
          conversationId: activeConversationId,
          lastMessageId: lastMessage.id
        });
        dispatch(markConversationRead({
          conversationId: activeConversationId,
          userId: currentUser.id
        }));
      }
    }
  }, [activeConversationId, dispatch, currentUser, allMessages]);

  useEffect(() => {
    if (!token) return;

    if (socketRef.current) return; // Prevent multiple connections

    const socket = io(CHAT_URL, {
      auth: { token },
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      dispatch(setSocketStatus('connected'));
      // Process queue
      queue.forEach(msg => {
        socket.emit('send_message', msg);
        incrementRetry(msg.tempId);
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      dispatch(setSocketStatus('disconnected'));
    });

    socket.on('receive_message', (msg) => {
      dispatch(addMessage(msg));
      const activeId = activeConvIdRef.current;
      const me = currentUserRef.current;
      if (activeId === msg.conversationId && msg.senderId !== me?.id) {
        socket.emit('message_read', { conversationId: msg.conversationId, lastMessageId: msg.id });
        dispatch(markConversationRead({ conversationId: msg.conversationId, userId: me?.id || '' }));
      }
    });

    socket.on('message_sent', ({ tempId, messageId }) => {
      dispatch(confirmMessage({ tempId, messageId, conversationId: '' }));
      dequeue(tempId);
    });

    socket.on('message_delivered', (data) => dispatch(updateMessageStatus({ ...data, status: 'delivered' })));
    socket.on('messages_read', (data) => dispatch(updateMessageStatus({ ...data, status: 'read' })));
    socket.on('message_edited', (msg) => dispatch(editMessage.fulfilled(msg, '', { messageId: msg.id, content: msg.content })));
    socket.on('message_deleted', (data) => dispatch(deleteMessage(data)));
    socket.on('typing_indicator', (data) => dispatch(setTyping(data)));
    socket.on('reaction_updated', (data) => dispatch(updateReactions(data)));
    socket.on('presence_update', (data) => dispatch(updatePresence(data)));

    socket.on('incoming_call', ({ callerName, meetingCode }) => {
      if (window.confirm(`${callerName} is calling you! Join the meeting?`)) {
        window.open(`/meeting/${meetingCode}`, '_blank');
      }
    });

    const hb = setInterval(() => { if (socket.connected) socket.emit('heartbeat'); }, 60000);

    return () => {
      clearInterval(hb);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, dispatch]);

  const emit = (event: string, data: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  };

  return (
    <ChatSocketContext.Provider value={{ socket: socketRef.current, isConnected, emit }}>
      {children}
    </ChatSocketContext.Provider>
  );
};

export const useChatSocketContext = () => {
  const context = useContext(ChatSocketContext);
  if (!context) throw new Error('useChatSocketContext must be used within a ChatSocketProvider');
  return context;
};
