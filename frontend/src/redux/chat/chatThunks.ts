import { createAsyncThunk } from '@reduxjs/toolkit';
import type { Conversation, Message } from './chatSlice';
import { chatApi } from '../../services/chatApi';

export const fetchConversations = createAsyncThunk<Conversation[], string | undefined>(
  'chat/fetchConversations',
  async (workspaceId) => chatApi.getConversations(workspaceId),
);

export const fetchMessages = createAsyncThunk<
  { messages: Message[]; nextCursor: string | null; conversationId: string },
  { conversationId: string; cursor?: string; limit?: number }
>('chat/fetchMessages', async ({ conversationId, cursor, limit }) => {
  const result = await chatApi.getMessages(conversationId, { cursor, limit });
  return { ...result, conversationId };
});

export const sendMessageRest = createAsyncThunk<
  Message,
  { conversationId: string; content?: string; type?: string; replyToId?: string; tempId?: string }
>('chat/sendMessageRest', async (payload) => {
  return chatApi.sendMessage(payload.conversationId, payload);
});

export const createDirectConversation = createAsyncThunk<Conversation, { targetUserId: string; workspaceId?: string }>(
  'chat/createDirect',
  async ({ targetUserId, workspaceId }) => chatApi.createConversation({ type: 'direct', targetUserId, workspaceId }),
);

export const createGroupConversation = createAsyncThunk<
  Conversation,
  { name: string; memberIds: string[]; description?: string; workspaceId?: string }
>('chat/createGroup', async (payload) => chatApi.createConversation({ type: 'group', ...payload }));

export const searchUsers = createAsyncThunk<
  { id: string; name: string; email: string }[],
  { query: string }
>('chat/searchUsers', async ({ query }) => chatApi.searchUsers(query));

export const searchMessages = createAsyncThunk<
  Message[],
  { conversationId: string; query: string }
>('chat/searchMessages', async ({ conversationId, query }) =>
  chatApi.searchMessages(conversationId, query),
);

export const toggleReaction = createAsyncThunk<
  { messageId: string; conversationId: string; reactions: any[] },
  { messageId: string; conversationId: string; emoji: string }
>('chat/toggleReaction', async ({ messageId, conversationId, emoji }) => {
  const result = await chatApi.reactToMessage(messageId, conversationId, emoji);
  return { messageId, conversationId, reactions: result.reactions };
});

export const editMessage = createAsyncThunk<
  Message,
  { messageId: string; content: string }
>('chat/editMessage', async ({ messageId, content }) => {
  return chatApi.editMessage(messageId, content);
});

export const deleteMessage = createAsyncThunk<
  { messageId: string; conversationId: string },
  { messageId: string; conversationId: string; forEveryone?: boolean }
>('chat/deleteMessage', async ({ messageId, conversationId, forEveryone }) => {
  await chatApi.deleteMessage(messageId, forEveryone);
  return { messageId, conversationId };
});

export const addMemberToGroup = createAsyncThunk<
  any,
  { conversationId: string; userId: string }
>('chat/addMember', async ({ conversationId, userId }) => {
  return chatApi.addMember(conversationId, userId);
});
