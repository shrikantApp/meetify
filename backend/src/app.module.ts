import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MeetingsModule } from './meetings/meetings.module';
import { SignalingModule } from './signaling/signaling.module';
import { User } from './users/entities/user.entity';
import { Meeting } from './meetings/entities/meeting.entity';
import { MeetingParticipant } from './meetings/entities/meeting-participant.entity';

@Module({
  imports: [
    // Load environment variables globally
    ConfigModule.forRoot({ isGlobal: true }),

    // Rate limiting (100 requests per 60 seconds)
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    // PostgreSQL connection via TypeORM using .env values
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST'),
        port: parseInt(config.get<string>('DB_PORT') ?? '5432', 10),
        username: config.get('DB_USER'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME'),
        entities: [User, Meeting, MeetingParticipant],
        synchronize: true, // Auto-creates tables in dev. Use migrations in production.
      }),
      inject: [ConfigService],
    }),

    AuthModule,
    UsersModule,
    MeetingsModule,
    SignalingModule,
  ],
})
export class AppModule { }
