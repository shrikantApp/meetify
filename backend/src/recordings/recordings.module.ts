import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { MeetingRecording } from '../meetings/entities/meeting-recording.entity';
import { RecordingsService } from './recordings.service';
import { RecordingsController } from './recordings.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([MeetingRecording]),
        MulterModule.register({
            limits: {
                fileSize: 2 * 1024 * 1024 * 1024, // 2GB
            },
        }),
    ],
    providers: [RecordingsService],
    controllers: [RecordingsController],
    exports: [RecordingsService],
})
export class RecordingsModule {}
