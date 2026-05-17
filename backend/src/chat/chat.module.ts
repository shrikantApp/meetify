import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatGateway } from './chat.gateway';
import { ChatController } from './chat.controller';
import { ConversationsService } from './services/conversations.service';
import { MessagesService } from './services/messages.service';
import { PresenceService } from './services/presence.service';
import { Conversation } from './entities/conversation.entity';
import { ConversationMember } from './entities/conversation-member.entity';
import { Message } from './entities/message.entity';
import { MessageStatus } from './entities/message-status.entity';
import { MessageReaction } from './entities/message-reaction.entity';
import { MessageAttachment } from './entities/message-attachment.entity';
import { UsersModule } from '../users/users.module';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Conversation,
      ConversationMember,
      Message,
      MessageStatus,
      MessageReaction,
      MessageAttachment,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
    UsersModule,
    WorkspacesModule,
  ],
  controllers: [ChatController],
  providers: [
    ChatGateway,
    ConversationsService,
    MessagesService,
    PresenceService,
    WsJwtGuard,
  ],
  exports: [ConversationsService, MessagesService, PresenceService],
})
export class ChatModule {}
