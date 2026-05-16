import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Message } from './message.entity';
import { User } from '../../users/entities/user.entity';

export enum StatusType {
  DELIVERED = 'delivered',
  READ = 'read',
}

@Entity('message_statuses')
@Index(['messageId', 'userId'], { unique: true })
export class MessageStatus {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'message_id', type: 'uuid' })
  messageId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @Column({ type: 'enum', enum: StatusType })
  status: StatusType;

  @CreateDateColumn({ name: 'status_at' })
  statusAt: Date;

  @ManyToOne(() => Message, (m) => m.statuses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message: Message;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
