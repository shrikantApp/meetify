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
        try {
            const meetingDir = path.join(this.recordingsPath, meetingId);
            if (!fs.existsSync(meetingDir)) {
                fs.mkdirSync(meetingDir, { recursive: true });
            }

            const extension = path.extname(file.originalname) || '.webm';
            const fileName = `recording-${Date.now()}${extension}`;
            const filePath = path.join(meetingId, fileName);
            const absolutePath = path.join(this.recordingsPath, filePath);

            console.log(`[RecordingsService] Saving file to ${absolutePath}`);
            fs.writeFileSync(absolutePath, file.buffer);

            const recording = this.recordingsRepository.create({
                meeting: { id: meetingId },
                host: { id: hostId },
                filePath,
                fileSize: file.size,
                duration: Math.round(duration),
            });

            const saved = await this.recordingsRepository.save(recording);
            console.log(`[RecordingsService] Saved metadata to DB with ID: ${saved.id}`);
            return saved;
        } catch (err) {
            console.error('[RecordingsService] Error saving recording:', err);
            throw err;
        }
    }

    async getRecordingsByMeeting(meetingId: string) {
        return this.recordingsRepository.find({
            where: { meeting: { id: meetingId } },
            order: { createdAt: 'DESC' },
        });
    }
}
