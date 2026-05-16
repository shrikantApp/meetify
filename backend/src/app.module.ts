import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MeetingsModule } from './meetings/meetings.module';
import { SignalingModule } from './signaling/signaling.module';
import database from './config/database';
import { configuration } from './config/configuration';
import { validationSchema } from './config/validation';
import { RecordingsModule } from './recordings/recordings.module';
import { ChatModule } from './chat/chat.module';
import { RedisModule } from './redis/redis.module';
import { UploadsModule } from './uploads/uploads.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import * as dotenv from 'dotenv';
dotenv.config();

@Module({
  imports: [
    // Load environment variables globally
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`${__dirname}/../../.env`, `${__dirname}/../.env`, '.env'],
      validationSchema: validationSchema,
      load: [configuration],
    }),

    // Rate limiting (100 requests per 60 seconds)
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    // PostgreSQL connection via TypeORM using .env values
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => database(configService),
      inject: [ConfigService],
    }),

    AuthModule,
    UsersModule,
    MeetingsModule,
    SignalingModule,
    RecordingsModule,
    RedisModule,
    ChatModule,
    UploadsModule,
    WorkspacesModule,
  ],
})
export class AppModule { }
