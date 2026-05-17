import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Message } from './message.entity';
import { ConversationMember } from './conversation-member.entity';
import { Workspace } from '../../workspaces/entities/workspace.entity';

export enum ConversationType {
  DIRECT = 'direct',
  GROUP = 'group',
  BROADCAST = 'broadcast',
}

export enum ConversationConfirmationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: ConversationType,
    default: ConversationType.DIRECT,
  })
  type!: ConversationType;

  @Column({ nullable: true })
  name!: string;

  @Column({ nullable: true })
  description!: string;

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl!: string;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'requires_confirmation', default: false })
  requiresConfirmation!: boolean;

  @Column({
    name: 'confirmation_status',
    type: 'enum',
    enum: ConversationConfirmationStatus,
    default: ConversationConfirmationStatus.ACCEPTED,
  })
  confirmationStatus!: ConversationConfirmationStatus;

  @Column({ name: 'last_message_at', nullable: true, type: 'timestamptz' })
  lastMessageAt!: Date;

  @Column({ name: 'pinned_message_id', nullable: true, type: 'uuid' })
  pinnedMessageId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => ConversationMember, (m) => m.conversation, { cascade: true })
  members!: ConversationMember[];

  @OneToMany(() => Message, (m) => m.conversation)
  messages!: Message[];

  @Column({ nullable: true, type: 'uuid' })
  workspaceId!: string;

  @ManyToOne(() => Workspace, (workspace) => workspace.conversations, {
    nullable: true,
  })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;
}
