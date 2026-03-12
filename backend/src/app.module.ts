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

@Module({
  imports: [
    // Load environment variables globally
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === "production" ? ".env.production" : ".env",
      validationSchema: validationSchema,
      load: [configuration],
    }),

    // Rate limiting (100 requests per 60 seconds)
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    // PostgreSQL connection via TypeORM using .env values
    TypeOrmModule.forRootAsync({
      // imports: [ConfigModule],
      // useFactory: (config: ConfigService) => ({
      //   type: 'postgres',
      //   host: config.get('POSTGRES_HOST'),
      //   port: parseInt(config.get<string>('POSTGRES_PORT') ?? '5432', 10),
      //   username: config.get('POSTGRES_USER'),
      //   password: config.get('POSTGRES_PASSWORD'),
      //   database: config.get('POSTGRES_DATABASE'),
      //   entities: [User, Meeting, MeetingParticipant],
      //   synchronize: true, // Auto-creates tables in dev. Use migrations in production.
      // }),
      // inject: [ConfigService],
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => database(configService),
      inject: [ConfigService],
    }),

    AuthModule,
    UsersModule,
    MeetingsModule,
    SignalingModule,
  ],
})
export class AppModule { }
