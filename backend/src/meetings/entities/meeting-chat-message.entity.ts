import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Meeting } from './meeting.entity';
import { User } from '../../users/entities/user.entity';

export type ChatMessageType = 'text' | 'file' | 'image' | 'system' | 'code';
export type ChatMessageChannel = 'everyone' | 'host-only' | 'direct';

@Entity('meeting_chat_messages')
export class MeetingChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Meeting, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'meeting_id' })
  meeting: Meeting;

  @Column({ name: 'meeting_id' })
  meetingId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column({ name: 'sender_id', nullable: true })
  senderId: string;

  @Column({ name: 'sender_name' })
  senderName: string;

  @Column({ name: 'sender_avatar', nullable: true })
  senderAvatar: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', default: 'text' })
  type: ChatMessageType;

  @Column({ name: 'file_url', nullable: true })
  fileUrl: string;

  @Column({ name: 'file_type', nullable: true })
  fileType: string;

  @Column({ name: 'recipient_user_id', nullable: true })
  recipientUserId: string;

  @Column({ type: 'varchar', default: 'everyone' })
  channel: ChatMessageChannel;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
