import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Not, In } from 'typeorm';
import { Message, MessageDeliveryStatus, MessageType } from '../entities/message.entity';
import { MessageStatus, StatusType } from '../entities/message-status.entity';
import { MessageReaction } from '../entities/message-reaction.entity';
import { ConversationMember } from '../entities/conversation-member.entity';
import {
  Conversation,
  ConversationConfirmationStatus,
} from '../entities/conversation.entity';
import { SendMessageDto } from '../dto/send-message.dto';
import { GetMessagesDto } from '../dto/get-messages.dto';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly msgRepo: Repository<Message>,
    @InjectRepository(MessageStatus)
    private readonly statusRepo: Repository<MessageStatus>,
    @InjectRepository(MessageReaction)
    private readonly reactionRepo: Repository<MessageReaction>,
    @InjectRepository(ConversationMember)
    private readonly memberRepo: Repository<ConversationMember>,
    @InjectRepository(Conversation)
    private readonly convRepo: Repository<Conversation>,
  ) {}

  async sendMessage(senderId: string, dto: SendMessageDto): Promise<Message> {
    const conversation = await this.convRepo.findOne({
      where: { id: dto.conversationId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (
      conversation.requiresConfirmation &&
      conversation.confirmationStatus !== ConversationConfirmationStatus.ACCEPTED
    ) {
      throw new ForbiddenException('Conversation request must be accepted before messaging');
    }

    const msg = this.msgRepo.create({
      conversationId: dto.conversationId,
      senderId,
      content: dto.content,
      type: dto.type ?? MessageType.TEXT,
      replyToId: dto.replyToId,
      mentions: dto.mentions,
      deliveryStatus: MessageDeliveryStatus.SENT,
    });
    const saved = await this.msgRepo.save(msg);

    // Update conversation's lastMessageAt
    await this.convRepo.update(dto.conversationId, { lastMessageAt: new Date() });

    // Increment unread counts for all members except sender
    await this.memberRepo
      .createQueryBuilder()
      .update(ConversationMember)
      .set({ unreadCount: () => '"unread_count" + 1' })
      .where('conversationId = :cid AND userId != :uid AND leftAt IS NULL', {
        cid: dto.conversationId,
        uid: senderId,
      })
      .execute();

    return this.getMessageById(saved.id);
  }

  async getMessages(conversationId: string, userId: string, dto: GetMessagesDto): Promise<{ messages: Message[]; nextCursor: string | null }> {
    const limit = dto.limit ?? 30;
    const qb = this.msgRepo
      .createQueryBuilder('m')
      .where('m.conversationId = :cid', { cid: conversationId })
      .andWhere('m.deletedForEveryone = false')
      .leftJoinAndSelect('m.sender', 'sender')
      .leftJoinAndSelect('m.replyTo', 'replyTo')
      .leftJoinAndSelect('replyTo.sender', 'replySender')
      .leftJoinAndSelect('m.attachments', 'attachments')
      .leftJoinAndSelect('m.reactions', 'reactions')
      .orderBy('m.createdAt', 'DESC')
      .take(limit + 1);

    if (dto.cursor) {
      const cursorDate = new Date(parseInt(dto.cursor));
      qb.andWhere('m.createdAt < :cursor', { cursor: cursorDate });
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const messages = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? messages[messages.length - 1].createdAt.getTime().toString() : null;

    return { messages: messages.reverse(), nextCursor };
  }

  async getMessageById(id: string): Promise<Message> {
    const msg = await this.msgRepo.findOne({
      where: { id },
      relations: ['sender', 'attachments', 'replyTo', 'replyTo.sender', 'reactions'],
    });
    if (!msg) throw new NotFoundException('Message not found');
    return msg;
  }

  async editMessage(messageId: string, userId: string, content: string): Promise<Message> {
    const msg = await this.msgRepo.findOne({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.senderId !== userId) throw new ForbiddenException('Cannot edit someone else\'s message');

    msg.content = content;
    msg.isEdited = true;
    await this.msgRepo.save(msg);
    return this.getMessageById(messageId);
  }

  async deleteMessage(messageId: string, userId: string, forEveryone = false): Promise<Message> {
    const msg = await this.msgRepo.findOne({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.senderId !== userId && forEveryone) throw new ForbiddenException('Only sender can delete for everyone');

    if (forEveryone) {
      msg.content = '';
      msg.deletedForEveryone = true;
      msg.isDeleted = true;
    } else {
      msg.isDeleted = true;
    }
    return this.msgRepo.save(msg);
  }

  async markDelivered(messageIds: string[], userId: string, conversationId: string): Promise<void> {
    const existing = await this.statusRepo.find({
      where: { messageId: In(messageIds), userId },
    });
    const existingIds = new Set(existing.map((s) => s.messageId));
    const toInsert = messageIds.filter((id) => !existingIds.has(id)).map((messageId) =>
      this.statusRepo.create({ messageId, userId, conversationId, status: StatusType.DELIVERED }),
    );
    if (toInsert.length) await this.statusRepo.save(toInsert);
  }

  async markRead(conversationId: string, userId: string, lastMessageId: string): Promise<void> {
    // Upsert read statuses for all unread messages up to lastMessageId
    const lastMsg = await this.msgRepo.findOne({ where: { id: lastMessageId } });
    if (!lastMsg) return;

    const unread = await this.msgRepo.find({
      where: {
        conversationId,
        createdAt: LessThan(new Date(lastMsg.createdAt.getTime() + 1)),
        senderId: Not(userId),
      },
      select: ['id'],
    });

    if (!unread.length) return;

    const ids = unread.map((m) => m.id);
    const existing = await this.statusRepo.find({ where: { messageId: In(ids), userId } });
    const existingMap = new Map(existing.map((s) => [s.messageId, s]));

    const toSave = ids.map((mid) => {
      const s = existingMap.get(mid) ?? this.statusRepo.create({ messageId: mid, userId, conversationId });
      s.status = StatusType.READ;
      return s;
    });
    try {
      await this.statusRepo.save(toSave);
    } catch (e: any) {
      // Ignore unique constraint violations (race condition during parallel markRead)
      if (e.code !== '23505') throw e;
    }

    // Reset unread count for this member
    await this.memberRepo.update(
      { conversationId, userId },
      { unreadCount: 0, lastReadMessageId: lastMessageId, lastReadAt: new Date() },
    );
  }

  async toggleReaction(messageId: string, userId: string, emoji: string): Promise<{ action: 'added' | 'removed'; reactions: MessageReaction[] }> {
    const existing = await this.reactionRepo.findOne({ where: { messageId, userId, emoji } });
    if (existing) {
      await this.reactionRepo.remove(existing);
    } else {
      await this.reactionRepo.save(this.reactionRepo.create({ messageId, userId, emoji }));
    }
    const reactions = await this.reactionRepo.find({ where: { messageId }, relations: ['user'] });
    return { action: existing ? 'removed' : 'added', reactions };
  }

  async searchMessages(conversationId: string, query: string, limit = 20): Promise<Message[]> {
    return this.msgRepo
      .createQueryBuilder('m')
      .where('m.conversationId = :cid', { cid: conversationId })
      .andWhere('m.content ILIKE :q', { q: `%${query}%` })
      .andWhere('m.deletedForEveryone = false')
      .leftJoinAndSelect('m.sender', 'sender')
      .orderBy('m.createdAt', 'DESC')
      .take(limit)
      .getMany();
  }

  async getReadStatusForMessage(messageId: string): Promise<{ delivered: string[]; read: string[] }> {
    const statuses = await this.statusRepo.find({ where: { messageId } });
    return {
      delivered: statuses.filter((s) => s.status === StatusType.DELIVERED).map((s) => s.userId),
      read: statuses.filter((s) => s.status === StatusType.READ).map((s) => s.userId),
    };
  }
}
