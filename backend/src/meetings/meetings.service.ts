/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Meeting } from './entities/meeting.entity';
import { MeetingParticipant } from './entities/meeting-participant.entity';
import {
  MeetingChatMessage,
  ChatMessageType,
  ChatMessageChannel,
} from './entities/meeting-chat-message.entity';
import { User } from '../users/entities/user.entity';
import { CreateMeetingDto } from './dto/create-meeting.dto';

@Injectable()
export class MeetingsService {
  constructor(
    @InjectRepository(Meeting)
    private meetingRepo: Repository<Meeting>,
    @InjectRepository(MeetingParticipant)
    private participantRepo: Repository<MeetingParticipant>,
    @InjectRepository(MeetingChatMessage)
    private chatMessageRepo: Repository<MeetingChatMessage>,
  ) {}

  /** Generate a unique 8-character alphanumeric meeting code */
  private generateCode(): string {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  async createMeeting(dto: CreateMeetingDto, host: User): Promise<Meeting> {
    let meetingCode = dto.meetingCode?.toUpperCase();

    if (meetingCode) {
      const existing = await this.meetingRepo.findOne({
        where: { meetingCode },
      });
      if (existing) {
        // If provided code exists, fall back to generation or throw error.
        // For now, let's generate a new one to be safe, but ideally we'd inform the user.
        meetingCode = await this.generateUniqueCode();
      }
    } else {
      meetingCode = await this.generateUniqueCode();
    }

    const meeting = this.meetingRepo.create({
      title: dto.title,
      description: dto.description,
      meetingCode,
      lobbyEnabled: dto.lobbyEnabled ?? true,
      host,
    });
    return this.meetingRepo.save(meeting);
  }

  private async generateUniqueCode(): Promise<string> {
    let code = '';
    let isUnique = false;
    while (!isUnique) {
      code = this.generateCode();
      const existing = await this.meetingRepo.findOne({
        where: { meetingCode: code },
      });
      if (!existing) isUnique = true;
    }
    return code;
  }

  async updateMeeting(
    meetingCode: string,
    hostId: string,
    updates: { lobbyEnabled?: boolean },
  ): Promise<Meeting> {
    const meeting = await this.meetingRepo.findOne({
      where: { meetingCode },
      relations: ['host'],
    });
    if (!meeting)
      throw new NotFoundException(`Meeting not found: ${meetingCode}`);
    if (meeting.host.id !== hostId) {
      throw new NotFoundException('Only the host may update this meeting');
    }
    if (updates.lobbyEnabled !== undefined) {
      meeting.lobbyEnabled = updates.lobbyEnabled;
    }
    return this.meetingRepo.save(meeting);
  }

  async findByCode(meetingCode: string): Promise<Meeting> {
    const meeting = await this.meetingRepo.findOne({
      where: { meetingCode },
      relations: ['host', 'participants', 'participants.user'],
    });
    if (!meeting) {
      throw new NotFoundException(`Meeting not found: ${meetingCode}`);
    }
    return meeting;
  }

  async listUserMeetings(userId: string): Promise<Meeting[]> {
    return this.meetingRepo.find({
      where: { host: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  /** Called when a user joins the meeting room via socket */
  async recordJoin(meeting: Meeting, user: User): Promise<MeetingParticipant> {
    const participant = this.participantRepo.create({ meeting, user });
    return this.participantRepo.save(participant);
  }

  /** Called when a user leaves the meeting room */
  async recordLeave(participantId: string): Promise<void> {
    const participant = await this.participantRepo.findOne({
      where: { id: participantId },
      relations: ['meeting'],
    });
    if (!participant) return;

    await this.participantRepo.update(participantId, { leftAt: new Date() });

    // If nobody is left in the meeting, mark it ended so chat UI doesn't show "Live Now".
    const remaining = await this.participantRepo.count({
      where: { meeting: { id: participant.meeting.id }, leftAt: null as any },
    });
    if (remaining === 0) {
      await this.meetingRepo.update(participant.meeting.id, {
        endedAt: new Date(),
      });
    }
  }

  async endMeeting(meetingCode: string, hostId: string): Promise<Meeting> {
    const meeting = await this.meetingRepo.findOne({
      where: { meetingCode },
      relations: ['host'],
    });
    if (!meeting)
      throw new NotFoundException(`Meeting not found: ${meetingCode}`);
    if (meeting.host.id !== hostId) {
      throw new NotFoundException('Only the host may end this meeting');
    }
    meeting.endedAt = new Date();
    return this.meetingRepo.save(meeting);
  }

  async saveChatMessage(data: {
    meetingCode: string;
    senderId?: string;
    senderName: string;
    senderAvatar?: string;
    content: string;
    type?: ChatMessageType;
    fileUrl?: string;
    fileType?: string;
    recipientUserId?: string;
    channel?: ChatMessageChannel;
  }): Promise<MeetingChatMessage> {
    const meeting = await this.meetingRepo.findOne({
      where: { meetingCode: data.meetingCode },
    });
    if (!meeting) {
      throw new NotFoundException(`Meeting not found: ${data.meetingCode}`);
    }

    const msg = this.chatMessageRepo.create({
      meetingId: meeting.id,
      senderId: data.senderId,
      senderName: data.senderName,
      senderAvatar: data.senderAvatar,
      content: data.content,
      type: data.type || 'text',
      fileUrl: data.fileUrl,
      fileType: data.fileType,
      recipientUserId: data.recipientUserId,
      channel: data.channel || 'everyone',
    });

    return this.chatMessageRepo.save(msg);
  }

  async getMeetingMessages(
    meetingCode: string,
    userId: string,
    limit = 100,
    offset = 0,
  ): Promise<MeetingChatMessage[]> {
    const meeting = await this.meetingRepo.findOne({
      where: { meetingCode },
      relations: ['host'],
    });
    if (!meeting) {
      throw new NotFoundException(`Meeting not found: ${meetingCode}`);
    }

    const isHost = meeting.host?.id === userId;

    const qb = this.chatMessageRepo
      .createQueryBuilder('msg')
      .where('msg.meeting_id = :meetingId', { meetingId: meeting.id });

    // Filter private DMs and host-only channels
    qb.andWhere(
      '(msg.channel = :everyone OR (msg.channel = :hostOnly AND :isHost = true) OR (msg.channel = :direct AND (msg.sender_id = :userId OR msg.recipient_user_id = :userId)))',
      {
        everyone: 'everyone',
        hostOnly: 'host-only',
        direct: 'direct',
        isHost,
        userId,
      },
    );

    qb.orderBy('msg.created_at', 'ASC').skip(offset).take(limit);

    return qb.getMany();
  }
}
