import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { MeetingsModule } from '../meetings/meetings.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [AuthModule, ConfigModule, MeetingsModule, UsersModule],
  providers: [EventsGateway],
})
export class SignalingModule { }
