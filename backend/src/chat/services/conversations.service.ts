import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Conversation, ConversationType } from '../entities/conversation.entity';
import { ConversationMember, MemberRole } from '../entities/conversation-member.entity';
import { UsersService } from '../../users/users.service';
import { CreateConversationDto } from '../dto/create-conversation.dto';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation)
    private readonly convRepo: Repository<Conversation>,
    @InjectRepository(ConversationMember)
    private readonly memberRepo: Repository<ConversationMember>,
    private readonly usersService: UsersService,
  ) { }

  /** Create or retrieve existing 1:1 direct conversation */
  async findOrCreateDirect(userId: string, targetUserId: string, workspaceId?: string): Promise<Conversation> {
    if (userId === targetUserId) throw new BadRequestException('Cannot chat with yourself');

    // Find existing direct conversation between these two users in this workspace
    const existing = await this.convRepo
      .createQueryBuilder('c')
      .innerJoin('c.members', 'm1', 'm1.userId = :userId AND m1.leftAt IS NULL', { userId })
      .innerJoin('c.members', 'm2', 'm2.userId = :targetUserId AND m2.leftAt IS NULL', { targetUserId })
      .where('c.type = :type', { type: ConversationType.DIRECT })
      .andWhere('c.isActive = true')
      .andWhere('c.workspaceId = :workspaceId', { workspaceId })
      .getOne();

    if (existing) return existing;

    const conv = this.convRepo.create({ 
      type: ConversationType.DIRECT, 
      createdBy: userId,
      workspaceId 
    });
    await this.convRepo.save(conv);

    await this.memberRepo.save([
      this.memberRepo.create({ conversationId: conv.id, userId, role: MemberRole.OWNER }),
      this.memberRepo.create({ conversationId: conv.id, userId: targetUserId, role: MemberRole.MEMBER }),
    ]);

    return this.getConversationById(conv.id, userId);
  }

  /** Create a group conversation */
  async createGroup(userId: string, dto: CreateConversationDto): Promise<Conversation> {
    const conv = this.convRepo.create({
      type: dto.type ?? ConversationType.GROUP,
      name: dto.name,
      description: dto.description,
      avatarUrl: dto.avatarUrl,
      createdBy: userId,
      workspaceId: dto.workspaceId,
    });
    await this.convRepo.save(conv);

    const memberIds = [...new Set([userId, ...(dto.memberIds ?? [])])];
    const members = memberIds.map((mid) =>
      this.memberRepo.create({
        conversationId: conv.id,
        userId: mid,
        role: mid === userId ? MemberRole.OWNER : MemberRole.MEMBER,
      }),
    );
    await this.memberRepo.save(members);
    return this.getConversationById(conv.id, userId);
  }

  /** List all conversations for a user (with last message info) */
  async getUserConversations(userId: string): Promise<any[]> {
    const convs = await this.convRepo
      .createQueryBuilder('c')
      .innerJoin('c.members', 'me', 'me.userId = :userId AND me.leftAt IS NULL AND me.isArchived = false', { userId })
      .leftJoinAndSelect('c.members', 'members')
      .leftJoinAndSelect('members.user', 'user')
      .leftJoinAndSelect('c.messages', 'messages', 'messages.id = (SELECT m2.id FROM messages m2 WHERE m2."conversation_id" = "c"."id" ORDER BY m2."created_at" DESC LIMIT 1)')
      .orderBy('c.lastMessageAt', 'DESC', 'NULLS LAST')
      .addOrderBy('c.createdAt', 'DESC')
      .getMany();

    return convs.map((c) => {
      const myMember = c.members?.find((m) => m.userId === userId);
      return {
        ...c,
        unreadCount: myMember?.unreadCount || 0,
        isMuted: myMember?.isMuted || false,
        isPinned: myMember?.isPinned || false,
        isArchived: myMember?.isArchived || false,
        lastMessage: c.messages?.[0],
      };
    });
  }

  async getConversationById(id: string, userId: string): Promise<Conversation> {
    const conv = await this.convRepo.findOne({
      where: { id },
      relations: ['members', 'members.user'],
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    const isMember = conv.members.some((m) => m.userId === userId && !m.leftAt);
    if (!isMember) throw new ForbiddenException('Not a member of this conversation');
    return conv;
  }

  async addMember(conversationId: string, actorId: string, targetUserId: string): Promise<ConversationMember> {
    const conv = await this.getConversationById(conversationId, actorId);
    if (conv.type === ConversationType.DIRECT) throw new BadRequestException('Cannot add members to a direct chat');

    const actorMember = conv.members.find((m) => m.userId === actorId);
    if (!actorMember || !([MemberRole.OWNER, MemberRole.ADMIN] as MemberRole[]).includes(actorMember.role)) {
      throw new ForbiddenException('Only admins can add members');
    }

    const existing = conv.members.find((m) => m.userId === targetUserId);
    if (existing && !existing.leftAt) throw new BadRequestException('User is already a member');

    if (existing && existing.leftAt) {
      existing.leftAt = null as any;
      return this.memberRepo.save(existing);
    }

    const member = this.memberRepo.create({ conversationId, userId: targetUserId, role: MemberRole.MEMBER });
    return this.memberRepo.save(member);
  }

  async removeMember(conversationId: string, actorId: string, targetUserId: string): Promise<void> {
    const conv = await this.getConversationById(conversationId, actorId);
    const actorMember = conv.members.find((m) => m.userId === actorId);
    const isSelf = actorId === targetUserId;

    if (!isSelf && (!actorMember || !([MemberRole.OWNER, MemberRole.ADMIN] as MemberRole[]).includes(actorMember.role))) {
      throw new ForbiddenException('Only admins can remove members');
    }

    const target = conv.members.find((m) => m.userId === targetUserId && !m.leftAt);
    if (!target) throw new NotFoundException('Member not found');

    target.leftAt = new Date();
    await this.memberRepo.save(target);
  }

  async updateMemberSettings(
    conversationId: string,
    userId: string,
    settings: { isMuted?: boolean; isArchived?: boolean; isPinned?: boolean },
  ): Promise<ConversationMember> {
    const member = await this.memberRepo.findOne({ where: { conversationId, userId } });
    if (!member) throw new NotFoundException('Membership not found');
    Object.assign(member, settings);
    return this.memberRepo.save(member);
  }

  async getMemberIds(conversationId: string): Promise<string[]> {
    const members = await this.memberRepo.find({
      where: { conversationId, leftAt: undefined },
      select: ['userId'],
    });
    return members.map((m) => m.userId);
  }

  async isMember(conversationId: string, userId: string): Promise<boolean> {
    const member = await this.memberRepo.findOne({ where: { conversationId, userId } });
    return !!(member && !member.leftAt);
  }
}
