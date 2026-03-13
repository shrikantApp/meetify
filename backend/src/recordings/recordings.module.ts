import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MeetingRecording } from '../meetings/entities/meeting-recording.entity';
import { RecordingsService } from './recordings.service';
import { RecordingsController } from './recordings.controller';

@Module({
    imports: [TypeOrmModule.forFeature([MeetingRecording])],
    providers: [RecordingsService],
    controllers: [RecordingsController],
    exports: [RecordingsService],
})
export class RecordingsModule {}
