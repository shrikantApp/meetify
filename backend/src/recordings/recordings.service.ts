import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MeetingRecording } from '../meetings/entities/meeting-recording.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class RecordingsService {
    private readonly recordingsPath = path.join(process.cwd(), 'recordings');

    constructor(
        @InjectRepository(MeetingRecording)
        private recordingsRepository: Repository<MeetingRecording>,
    ) {
        if (!fs.existsSync(this.recordingsPath)) {
            fs.mkdirSync(this.recordingsPath, { recursive: true });
        }
    }

    async saveRecording(meetingId: string, hostId: string, file: Express.Multer.File, duration: number) {
        const meetingDir = path.join(this.recordingsPath, meetingId);
        if (!fs.existsSync(meetingDir)) {
            fs.mkdirSync(meetingDir, { recursive: true });
        }

        const fileName = `recording-${Date.now()}.webm`;
        const filePath = path.join(meetingId, fileName);
        const absolutePath = path.join(this.recordingsPath, filePath);

        fs.writeFileSync(absolutePath, file.buffer);

        const recording = this.recordingsRepository.create({
            meetingId,
            hostId,
            filePath,
            fileSize: file.size,
            duration,
        });

        return this.recordingsRepository.save(recording);
    }

    async getRecordingsByMeeting(meetingId: string) {
        return this.recordingsRepository.find({
            where: { meetingId },
            order: { createdAt: 'DESC' },
        });
    }
}
