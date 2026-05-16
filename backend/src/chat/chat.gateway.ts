import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedSocket } from './guards/ws-jwt.guard';
import { MessagesService } from './services/messages.service';
import { ConversationsService } from './services/conversations.service';
import { PresenceService } from './services/presence.service';

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: process.env.ALLOW_WEBSITE_URLS?.split(',') || 'http://localhost:5173',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly messagesService: MessagesService,
    private readonly conversationsService: ConversationsService,
    private readonly presenceService: PresenceService,
  ) {}

  // ── CONNECTION ────────────────────────────────────────────────────────────

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string;
      if (!token) throw new Error('No token');

      const payload = this.jwtService.verify<{ sub: string; email: string }>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const authClient = client as unknown as AuthenticatedSocket;
      authClient.userId = payload.sub;
      authClient.userEmail = payload.email;

      await this.presenceService.setOnline(payload.sub, client.id);

      const conversations = await this.conversationsService.getUserConversations(payload.sub);
      for (const conv of conversations) {
        await client.join(`conv:${conv.id}`);
      }

      this.broadcastPresence(payload.sub, true);
      this.logger.log(`[Chat] Connected: ${payload.sub} (${client.id})`);
    } catch (err) {
      this.logger.warn(`[Chat] Auth failed: ${err instanceof Error ? err.message : 'unknown'}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const authClient = client as unknown as AuthenticatedSocket;
    if (!authClient.userId) return;
    await this.presenceService.setOffline(authClient.userId, client.id);
    const lastSeen = await this.presenceService.getLastSeen(authClient.userId);
    this.broadcastPresence(authClient.userId, false, lastSeen ?? undefined);
    this.logger.log(`[Chat] Disconnected: ${authClient.userId}`);
  }

  private broadcastPresence(userId: string, online: boolean, lastSeen?: Date) {
    this.server.emit('presence_update', { userId, online, lastSeen: lastSeen?.toISOString() });
  }

  // ── MESSAGING ─────────────────────────────────────────────────────────────

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string; content?: string; type?: string; replyToId?: string; mentions?: string[]; tempId?: string },
  ) {
    const authClient = client as unknown as AuthenticatedSocket;
    if (!authClient.userId) return;

    const isMember = await this.conversationsService.isMember(body.conversationId, authClient.userId);
    if (!isMember) return client.emit('error', { event: 'send_message', message: 'Not a member' });

    const message = await this.messagesService.sendMessage(authClient.userId, {
      conversationId: body.conversationId,
      content: body.content,
      type: body.type as any,
      replyToId: body.replyToId,
      mentions: body.mentions,
      tempId: body.tempId,
    });

    // Attach tempId for optimistic UI replacement on sender side
    (message as any).tempId = body.tempId;

    this.server.to(`conv:${body.conversationId}`).emit('receive_message', message);
    client.emit('message_sent', { tempId: body.tempId, messageId: message.id });

    const memberIds = await this.conversationsService.getMemberIds(body.conversationId);
    const deliveredTo: string[] = [];
    for (const uid of memberIds) {
      if (uid === authClient.userId) continue;
      const online = await this.presenceService.isOnline(uid);
      if (online) {
        deliveredTo.push(uid);
        await this.messagesService.markDelivered([message.id], uid, body.conversationId);
      }
    }

    if (deliveredTo.length) {
      this.server.to(`conv:${body.conversationId}`).emit('message_delivered', {
        messageId: message.id,
        conversationId: body.conversationId,
        deliveredTo,
      });
    }
  }

  @SubscribeMessage('get_messages')
  async handleGetMessages(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string; cursor?: string; limit?: number },
  ) {
    const authClient = client as unknown as AuthenticatedSocket;
    if (!authClient.userId) return;
    const result = await this.messagesService.getMessages(body.conversationId, authClient.userId, body);
    client.emit('messages_loaded', result);
  }

  @SubscribeMessage('edit_message')
  async handleEditMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { messageId: string; content: string },
  ) {
    const authClient = client as unknown as AuthenticatedSocket;
    if (!authClient.userId) return;
    const message = await this.messagesService.editMessage(body.messageId, authClient.userId, body.content);
    this.server.to(`conv:${message.conversationId}`).emit('message_edited', message);
  }

  @SubscribeMessage('delete_message')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { messageId: string; conversationId: string; forEveryone?: boolean },
  ) {
    const authClient = client as unknown as AuthenticatedSocket;
    if (!authClient.userId) return;
    await this.messagesService.deleteMessage(body.messageId, authClient.userId, body.forEveryone);
    if (body.forEveryone) {
      this.server.to(`conv:${body.conversationId}`).emit('message_deleted', { messageId: body.messageId, conversationId: body.conversationId });
    } else {
      client.emit('message_deleted', { messageId: body.messageId, conversationId: body.conversationId });
    }
  }

  @SubscribeMessage('typing_start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string },
  ) {
    const authClient = client as unknown as AuthenticatedSocket;
    if (!authClient.userId) return;
    client.to(`conv:${body.conversationId}`).emit('typing_indicator', {
      conversationId: body.conversationId,
      userId: authClient.userId,
      typing: true,
    });
  }

  @SubscribeMessage('typing_stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string },
  ) {
    const authClient = client as unknown as AuthenticatedSocket;
    if (!authClient.userId) return;
    client.to(`conv:${body.conversationId}`).emit('typing_indicator', {
      conversationId: body.conversationId,
      userId: authClient.userId,
      typing: false,
    });
  }

  @SubscribeMessage('message_read')
  async handleMessageRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string; lastMessageId: string },
  ) {
    const authClient = client as unknown as AuthenticatedSocket;
    if (!authClient.userId) return;
    await this.messagesService.markRead(body.conversationId, authClient.userId, body.lastMessageId);
    this.server.to(`conv:${body.conversationId}`).emit('messages_read', {
      conversationId: body.conversationId,
      userId: authClient.userId,
      lastMessageId: body.lastMessageId,
    });
  }

  @SubscribeMessage('message_delivered')
  async handleMessageDelivered(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { messageIds: string[]; conversationId: string },
  ) {
    const authClient = client as unknown as AuthenticatedSocket;
    if (!authClient.userId) return;
    await this.messagesService.markDelivered(body.messageIds, authClient.userId, body.conversationId);
    this.server.to(`conv:${body.conversationId}`).emit('message_delivered', {
      conversationId: body.conversationId,
      messageIds: body.messageIds,
      userId: authClient.userId,
    });
  }

  @SubscribeMessage('react_message')
  async handleReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { messageId: string; conversationId: string; emoji: string },
  ) {
    const authClient = client as unknown as AuthenticatedSocket;
    if (!authClient.userId) return;
    const result = await this.messagesService.toggleReaction(body.messageId, authClient.userId, body.emoji);
    this.server.to(`conv:${body.conversationId}`).emit('reaction_updated', {
      messageId: body.messageId,
      conversationId: body.conversationId,
      reactions: result.reactions,
    });
  }

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string },
  ) {
    const authClient = client as unknown as AuthenticatedSocket;
    if (!authClient.userId) return;
    const isMember = await this.conversationsService.isMember(body.conversationId, authClient.userId);
    if (!isMember) return client.emit('error', { message: 'Not a member' });
    await client.join(`conv:${body.conversationId}`);
    client.emit('joined_conversation', { conversationId: body.conversationId });
  }

  @SubscribeMessage('leave_conversation')
  async handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string },
  ) {
    const authClient = client as unknown as AuthenticatedSocket;
    if (!authClient.userId) return;
    await client.leave(`conv:${body.conversationId}`);
  }

  @SubscribeMessage('get_presence')
  async handleGetPresence(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { userIds: string[] },
  ) {
    const authClient = client as unknown as AuthenticatedSocket;
    if (!authClient.userId) return;
    const presence = await this.presenceService.getBulkPresence(body.userIds);
    client.emit('presence_data', presence);
  }

  @SubscribeMessage('heartbeat')
  async handleHeartbeat(@ConnectedSocket() client: Socket) {
    const authClient = client as unknown as AuthenticatedSocket;
    if (!authClient.userId) return;
    await this.presenceService.heartbeat(authClient.userId, client.id);
  }

  @SubscribeMessage('call_invite')
  handleCallInvite(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string; meetingCode: string; callerName: string },
  ) {
    const authClient = client as unknown as AuthenticatedSocket;
    if (!authClient.userId) return;
    client.to(`conv:${body.conversationId}`).emit('incoming_call', {
      conversationId: body.conversationId,
      meetingCode: body.meetingCode,
      callerName: body.callerName,
      callerId: authClient.userId,
    });
  }
}
