import type { RootState } from '../store';

export const selectConversations = (state: RootState) =>
  state.chat.conversationOrder
    .map((id) => state.chat.conversations[id])
    .filter(Boolean);

export const selectActiveConversationId = (state: RootState) => state.chat.activeConversationId;

export const selectActiveConversation = (state: RootState) => {
  const id = state.chat.activeConversationId;
  return id ? state.chat.conversations[id] : null;
};

export const selectMessages = (conversationId: string) => (state: RootState) =>
  state.chat.messages[conversationId] ?? [];

export const selectHasMoreMessages = (conversationId: string) => (state: RootState) =>
  state.chat.hasMoreMessages[conversationId] ?? false;

export const selectMessageCursor = (conversationId: string) => (state: RootState) =>
  state.chat.messageCursors[conversationId] ?? null;

export const selectTypingUsers = (conversationId: string) => (state: RootState) =>
  state.chat.typingUsers[conversationId] ?? [];

export const selectPresence = (userId: string) => (state: RootState) =>
  state.chat.presence[userId] ?? { online: false, lastSeen: null };

export const selectSocketStatus = (state: RootState) => state.chat.socketStatus;

export const selectUnreadCount = (conversationId: string) => (state: RootState) =>
  state.chat.conversations[conversationId]?.unreadCount ?? 0;

export const selectTotalUnread = (state: RootState) =>
  Object.values(state.chat.conversations).reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);

export const selectIsLoadingConversations = (state: RootState) => state.chat.isLoadingConversations;

export const selectIsLoadingMessages = (conversationId: string) => (state: RootState) =>
  state.chat.isLoadingMessages[conversationId] ?? false;

export const selectSearchResults = (state: RootState) => state.chat.searchResults;
export const selectUserSearchResults = (state: RootState) => state.chat.userSearchResults;
export const selectCommunities = (state: RootState) => Object.values(state.chat.communities);
