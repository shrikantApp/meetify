import { Controller, Post, Get, Param, UploadedFile, UseInterceptors, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RecordingsService } from './recordings.service';

@Controller('meeting-recording')
export class RecordingsController {
    constructor(private readonly recordingsService: RecordingsService) {}

    @Post()
    @UseInterceptors(FileInterceptor('recordingFile'))
    async uploadRecording(
        @UploadedFile() file: Express.Multer.File,
        @Body('meetingId') meetingId: string,
        @Body('hostId') hostId: string,
        @Body('duration') duration: number,
    ) {
        return this.recordingsService.saveRecording(meetingId, hostId, file, duration);
    }

    @Get(':meetingId/recordings')
    async getRecordings(@Param('meetingId') meetingId: string) {
        return this.recordingsService.getRecordingsByMeeting(meetingId);
    }
}
