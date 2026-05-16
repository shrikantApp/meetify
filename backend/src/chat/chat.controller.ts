import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConversationsService } from './services/conversations.service';
import { MessagesService } from './services/messages.service';
import { PresenceService } from './services/presence.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { ConversationType } from './entities/conversation.entity';

@Controller('chat')
@UseGuards(AuthGuard('jwt'))
export class ChatController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly presenceService: PresenceService,
  ) {}

  // ── CONVERSATIONS ─────────────────────────────────────────────────────────

  @Get('conversations')
  getConversations(@Request() req: any) {
    return this.conversationsService.getUserConversations(req.user.id);
  }

  @Post('conversations')
  async createConversation(@Request() req: any, @Body() dto: CreateConversationDto) {
    const userId = req.user.id;
    if (dto.type === ConversationType.DIRECT && dto.targetUserId) {
      return this.conversationsService.findOrCreateDirect(userId, dto.targetUserId, dto.workspaceId);
    }
    return this.conversationsService.createGroup(userId, dto);
  }

  @Get('conversations/:id')
  getConversation(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.conversationsService.getConversationById(id, req.user.id);
  }

  @Patch('conversations/:id/mute')
  muteConversation(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @Body() body: { isMuted: boolean },
  ) {
    return this.conversationsService.updateMemberSettings(id, req.user.id, { isMuted: body.isMuted });
  }

  @Patch('conversations/:id/archive')
  archiveConversation(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @Body() body: { isArchived: boolean },
  ) {
    return this.conversationsService.updateMemberSettings(id, req.user.id, { isArchived: body.isArchived });
  }

  @Post('conversations/:id/members')
  addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @Body() body: { userId: string },
  ) {
    return this.conversationsService.addMember(id, req.user.id, body.userId);
  }

  @Delete('conversations/:id/members/:userId')
  removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Request() req: any,
  ) {
    return this.conversationsService.removeMember(id, req.user.id, userId);
  }

  // ── MESSAGES ──────────────────────────────────────────────────────────────

  @Get('conversations/:id/messages')
  getMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: GetMessagesDto,
    @Request() req: any,
  ) {
    return this.messagesService.getMessages(id, req.user.id, query);
  }

  @Post('conversations/:id/messages')
  sendMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
    @Request() req: any,
  ) {
    return this.messagesService.sendMessage(req.user.id, { ...dto, conversationId: id });
  }

  @Patch('messages/:id')
  editMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { content: string },
    @Request() req: any,
  ) {
    return this.messagesService.editMessage(id, req.user.id, body.content);
  }

  @Delete('messages/:id')
  deleteMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('forEveryone') forEveryone: string,
    @Request() req: any,
  ) {
    return this.messagesService.deleteMessage(id, req.user.id, forEveryone === 'true');
  }

  @Post('messages/:id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { conversationId: string },
    @Request() req: any,
  ) {
    return this.messagesService.markRead(body.conversationId, req.user.id, id);
  }

  @Post('messages/:id/react')
  react(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { conversationId: string; emoji: string },
    @Request() req: any,
  ) {
    return this.messagesService.toggleReaction(id, req.user.id, body.emoji);
  }

  @Get('conversations/:id/search')
  searchMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('q') q: string,
  ) {
    return this.messagesService.searchMessages(id, q);
  }

  @Get('messages/:id/status')
  getMessageStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.messagesService.getReadStatusForMessage(id);
  }

  // ── PRESENCE ──────────────────────────────────────────────────────────────

  @Get('presence')
  async getPresence(@Query('userIds') userIds: string) {
    const ids = userIds?.split(',').filter(Boolean) ?? [];
    return this.presenceService.getBulkPresence(ids);
  }
}
