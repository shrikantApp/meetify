import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Message } from './message.entity';

export enum AttachmentType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  VOICE_NOTE = 'voice_note',
}

@Entity('message_attachments')
export class MessageAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'message_id', type: 'uuid' })
  messageId: string;

  @Column({ type: 'enum', enum: AttachmentType })
  type: AttachmentType;

  /** MinIO/S3 object key */
  @Column({ name: 'storage_key' })
  storageKey: string;

  /** Public/CDN URL or presigned URL at access time */
  @Column({ name: 'url' })
  url: string;

  @Column({ name: 'original_name' })
  originalName: string;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes: number;

  /** For images/videos */
  @Column({ nullable: true })
  width: number;

  @Column({ nullable: true })
  height: number;

  /** Duration in seconds for audio/video */
  @Column({ nullable: true, type: 'float' })
  duration: number;

  /** Blurred thumbnail base64 for images */
  @Column({ name: 'thumbnail_url', nullable: true })
  thumbnailUrl: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Message, (m) => m.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message: Message;
}
