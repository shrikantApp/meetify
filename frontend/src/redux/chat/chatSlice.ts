import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  fetchConversations,
  fetchMessages,
  searchUsers,
  searchMessages,
  createDirectConversation,
  createGroupConversation,
  editMessage,
} from './chatThunks';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Attachment {
  id: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'voice_note';
  url: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
}

export interface Reaction {
  id: string;
  emoji: string;
  userId: string;
  user?: { id: string; name: string };
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: { id: string; name: string; avatar?: string };
  content?: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'voice_note' | 'system';
  deliveryStatus: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  replyToId?: string;
  replyTo?: Message;
  parentMessageId?: string;
  forwardedFromId?: string;
  isEdited: boolean;
  isDeleted: boolean;
  deletedForEveryone: boolean;
  mentions?: string[];
  attachments?: Attachment[];
  reactions?: Reaction[];
  createdAt: string;
  updatedAt: string;
  // Optimistic UI
  tempId?: string;
  isPending?: boolean;
}

export interface ConversationMember {
  id: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  isMuted: boolean;
  isArchived: boolean;
  isPinned: boolean;
  unreadCount: number;
  lastReadMessageId?: string;
  user?: { id: string; name: string; avatar?: string };
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group' | 'broadcast';
  name?: string;
  description?: string;
  avatarUrl?: string;
  createdBy: string;
  lastMessageAt?: string;
  pinnedMessageId?: string;
  members?: ConversationMember[];
  workspaceId?: string;
  createdAt: string;
  updatedAt: string;
  // Derived / UI state
  unreadCount?: number;
  isMuted?: boolean;
  isArchived?: boolean;
  isPinned?: boolean;
  lastMessage?: Message;
}

export interface UserPresence {
  online: boolean;
  lastSeen: string | null;
}

export interface Community {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  visibility: 'public' | 'private';
  createdBy: string;
  requireApproval: boolean;
  inviteLink?: string;
  createdAt: string;
}

// ── State ──────────────────────────────────────────────────────────────────

interface ChatState {
  conversations: Record<string, Conversation>;
  conversationOrder: string[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>;
  messageCursors: Record<string, string | null>;
  hasMoreMessages: Record<string, boolean>;
  presence: Record<string, UserPresence>;
  typingUsers: Record<string, string[]>;
  socketStatus: 'connected' | 'disconnected' | 'reconnecting';
  communities: Record<string, Community>;
  pendingMessages: Message[];
  isLoadingConversations: boolean;
  isLoadingMessages: Record<string, boolean>;
  searchResults: Message[];
  userSearchResults: { id: string; name: string; email: string; avatar?: string }[];
}

const initialState: ChatState = {
  conversations: {},
  conversationOrder: [],
  activeConversationId: null,
  messages: {},
  messageCursors: {},
  hasMoreMessages: {},
  presence: {},
  typingUsers: {},
  socketStatus: 'disconnected',
  communities: {},
  pendingMessages: [],
  isLoadingConversations: false,
  isLoadingMessages: {},
  searchResults: [],
  userSearchResults: [],
};

// ── Slice ──────────────────────────────────────────────────────────────────

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setSocketStatus(state, action: PayloadAction<ChatState['socketStatus']>) {
      state.socketStatus = action.payload;
    },

    setConversations(state, action: PayloadAction<Conversation[]>) {
      state.isLoadingConversations = false;
      state.conversations = {};
      state.conversationOrder = [];
      for (const conv of action.payload) {
        state.conversations[conv.id] = conv;
        state.conversationOrder.push(conv.id);
      }
    },

    upsertConversation(state, action: PayloadAction<Conversation>) {
      const conv = action.payload;
      state.conversations[conv.id] = { ...state.conversations[conv.id], ...conv };
      if (!state.conversationOrder.includes(conv.id)) {
        state.conversationOrder.unshift(conv.id);
      }
    },

    setActiveConversation(state, action: PayloadAction<string | null>) {
      state.activeConversationId = action.payload;
    },

    setMessages(
      state,
      action: PayloadAction<{ conversationId: string; messages: Message[]; nextCursor: string | null }>,
    ) {
      const { conversationId, messages, nextCursor } = action.payload;
      state.messages[conversationId] = messages;
      state.messageCursors[conversationId] = nextCursor;
      state.hasMoreMessages[conversationId] = nextCursor !== null;
      state.isLoadingMessages[conversationId] = false;
    },

    prependMessages(
      state,
      action: PayloadAction<{ conversationId: string; messages: Message[]; nextCursor: string | null }>,
    ) {
      const { conversationId, messages, nextCursor } = action.payload;
      const existing = state.messages[conversationId] ?? [];
      state.messages[conversationId] = [...messages, ...existing];
      state.messageCursors[conversationId] = nextCursor;
      state.hasMoreMessages[conversationId] = nextCursor !== null;
      state.isLoadingMessages[conversationId] = false;
    },

    addMessage(state, action: PayloadAction<Message>) {
      const msg = action.payload;
      const list = state.messages[msg.conversationId] ?? [];

      // Replace optimistic message if tempId matches
      const optimisticIdx = list.findIndex((m) => m.tempId && m.tempId === msg.tempId);
      if (optimisticIdx >= 0) {
        list[optimisticIdx] = msg;
      } else if (!list.find((m) => m.id === msg.id)) {
        list.push(msg);
      }
      state.messages[msg.conversationId] = list;

      // Move conversation to top
      const conv = state.conversations[msg.conversationId];
      if (conv) {
        conv.lastMessage = msg;
        conv.lastMessageAt = msg.createdAt;
        // Bump to top
        state.conversationOrder = [
          msg.conversationId,
          ...state.conversationOrder.filter((id) => id !== msg.conversationId),
        ];
      }
    },

    addOptimisticMessage(state, action: PayloadAction<Message>) {
      const msg = { ...action.payload, isPending: true };
      const list = state.messages[msg.conversationId] ?? [];
      list.push(msg);
      state.messages[msg.conversationId] = list;
      state.pendingMessages.push(msg);
    },

    confirmMessage(state, action: PayloadAction<{ tempId: string; messageId: string; conversationId: string }>) {
      const { tempId, messageId, conversationId } = action.payload;
      const list = state.messages[conversationId] ?? [];
      const idx = list.findIndex((m) => m.tempId === tempId);
      if (idx >= 0) {
        list[idx].id = messageId;
        list[idx].isPending = false;
        list[idx].deliveryStatus = 'sent';
      }
      state.pendingMessages = state.pendingMessages.filter((m) => m.tempId !== tempId);
    },

    failMessage(state, action: PayloadAction<{ tempId: string; conversationId: string }>) {
      const { tempId, conversationId } = action.payload;
      const list = state.messages[conversationId] ?? [];
      const idx = list.findIndex((m) => m.tempId === tempId);
      if (idx >= 0) list[idx].deliveryStatus = 'failed';
    },

    updateMessageStatus(
      state,
      action: PayloadAction<{ conversationId: string; messageId?: string; messageIds?: string[]; status: Message['deliveryStatus']; userId?: string }>,
    ) {
      const { conversationId, messageId, messageIds, status } = action.payload;
      const list = state.messages[conversationId] ?? [];
      const idsToUpdate = new Set(messageIds ?? (messageId ? [messageId] : []));
      for (const msg of list) {
        if (idsToUpdate.has(msg.id)) {
          const order = ['sending', 'sent', 'delivered', 'read'];
          if (order.indexOf(status) > order.indexOf(msg.deliveryStatus)) {
            msg.deliveryStatus = status;
          }
        }
      }
    },

    markConversationRead(state, action: PayloadAction<{ conversationId: string; userId: string }>) {
      const { conversationId, userId } = action.payload;
      const conv = state.conversations[conversationId];
      if (conv) conv.unreadCount = 0;
      const list = state.messages[conversationId] ?? [];
      for (const msg of list) {
        if (msg.senderId !== userId) {
          const order = ['sending', 'sent', 'delivered', 'read'];
          if (order.indexOf('read') > order.indexOf(msg.deliveryStatus)) {
            msg.deliveryStatus = 'read';
          }
        }
      }
    },

    deleteMessage(state, action: PayloadAction<{ messageId: string; conversationId: string }>) {
      const { messageId, conversationId } = action.payload;
      const list = state.messages[conversationId] ?? [];
      const idx = list.findIndex((m) => m.id === messageId);
      if (idx >= 0) {
        list[idx].deletedForEveryone = true;
        list[idx].content = '';
        list[idx].attachments = [];
      }
    },

    updateReactions(state, action: PayloadAction<{ conversationId: string; messageId: string; reactions: Reaction[] }>) {
      const { conversationId, messageId, reactions } = action.payload;
      const list = state.messages[conversationId] ?? [];
      const msg = list.find((m) => m.id === messageId);
      if (msg) msg.reactions = reactions;
    },

    setTyping(state, action: PayloadAction<{ conversationId: string; userId: string; typing: boolean }>) {
      const { conversationId, userId, typing } = action.payload;
      const current = state.typingUsers[conversationId] ?? [];
      if (typing) {
        if (!current.includes(userId)) state.typingUsers[conversationId] = [...current, userId];
      } else {
        state.typingUsers[conversationId] = current.filter((id) => id !== userId);
      }
    },

    setPresence(state, action: PayloadAction<Record<string, UserPresence>>) {
      Object.assign(state.presence, action.payload);
    },

    updatePresence(state, action: PayloadAction<{ userId: string; online: boolean; lastSeen?: string | null }>) {
      state.presence[action.payload.userId] = {
        online: action.payload.online,
        lastSeen: action.payload.lastSeen ?? null,
      };
    },

    setIsLoadingConversations(state, action: PayloadAction<boolean>) {
      state.isLoadingConversations = action.payload;
    },

    setIsLoadingMessages(state, action: PayloadAction<{ conversationId: string; loading: boolean }>) {
      state.isLoadingMessages[action.payload.conversationId] = action.payload.loading;
    },

    setSearchResults(state, action: PayloadAction<Message[]>) {
      state.searchResults = action.payload;
    },

    setUserSearchResults(state, action: PayloadAction<{ id: string; name: string; email: string; avatar?: string }[]>) {
      state.userSearchResults = action.payload;
    },

    setCommunities(state, action: PayloadAction<Community[]>) {
      for (const c of action.payload) state.communities[c.id] = c;
    },
  },
  extraReducers: (builder) => {
    builder
      // Conversations
      .addCase(fetchConversations.pending, (state) => {
        state.isLoadingConversations = true;
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.isLoadingConversations = false;
        state.conversations = {};
        state.conversationOrder = [];
        for (const conv of action.payload) {
          state.conversations[conv.id] = conv;
          state.conversationOrder.push(conv.id);
        }
      })
      .addCase(fetchConversations.rejected, (state) => {
        state.isLoadingConversations = false;
      })

      // Messages
      .addCase(fetchMessages.pending, (state, action) => {
        state.isLoadingMessages[action.meta.arg.conversationId] = true;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        const { conversationId, messages, nextCursor } = action.payload;
        state.messages[conversationId] = messages;
        state.messageCursors[conversationId] = nextCursor;
        state.hasMoreMessages[conversationId] = nextCursor !== null;
        state.isLoadingMessages[conversationId] = false;
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        state.isLoadingMessages[action.meta.arg.conversationId] = false;
      })

      // Create Conversation
      .addCase(createDirectConversation.fulfilled, (state, action) => {
        const conv = action.payload;
        state.conversations[conv.id] = { ...state.conversations[conv.id], ...conv };
        if (!state.conversationOrder.includes(conv.id)) {
          state.conversationOrder.unshift(conv.id);
        }
      })
      .addCase(createGroupConversation.fulfilled, (state, action) => {
        const conv = action.payload;
        state.conversations[conv.id] = { ...state.conversations[conv.id], ...conv };
        if (!state.conversationOrder.includes(conv.id)) {
          state.conversationOrder.unshift(conv.id);
        }
      })

      // Edit Message
      .addCase(editMessage.fulfilled, (state, action) => {
        const msg = action.payload;
        const list = state.messages[msg.conversationId] ?? [];
        const idx = list.findIndex((m) => m.id === msg.id);
        if (idx >= 0) list[idx] = msg;
      })

      // Search
      .addCase(searchUsers.fulfilled, (state, action) => {
        state.userSearchResults = action.payload;
      })
      .addCase(searchMessages.fulfilled, (state, action) => {
        state.searchResults = action.payload;
      });
  },
});

export const {
  setSocketStatus,
  setConversations,
  upsertConversation,
  setActiveConversation,
  setMessages,
  prependMessages,
  addMessage,
  addOptimisticMessage,
  confirmMessage,
  failMessage,
  updateMessageStatus,
  markConversationRead,
  deleteMessage,
  updateReactions,
  setTyping,
  setPresence,
  updatePresence,
  setIsLoadingConversations,
  setIsLoadingMessages,
  setSearchResults,
  setUserSearchResults,
  setCommunities,
} = chatSlice.actions;

export default chatSlice.reducer;
