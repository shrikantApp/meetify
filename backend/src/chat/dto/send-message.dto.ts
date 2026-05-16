import { IsString, IsUUID, IsOptional, IsEnum, IsArray } from 'class-validator';
import { MessageType } from '../entities/message.entity';

export class SendMessageDto {
  @IsUUID()
  conversationId: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @IsOptional()
  @IsUUID()
  replyToId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  mentions?: string[];

  /** Client-generated temp ID for optimistic UI reconciliation */
  @IsOptional()
  @IsString()
  tempId?: string;
}
