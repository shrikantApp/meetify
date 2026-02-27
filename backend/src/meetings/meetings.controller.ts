import {
    Controller,
    Post,
    Get,
    Param,
    Body,
    UseGuards,
    Request,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard) // All meeting routes require authentication
@Controller('meetings')
export class MeetingsController {
    constructor(private readonly meetingsService: MeetingsService) { }

    /** POST /api/meetings – Create a new meeting */
    @Post()
    create(@Body() dto: CreateMeetingDto, @Request() req: ExpressRequest & { user: any }) {
        return this.meetingsService.createMeeting(dto, req.user);
    }

    /** GET /api/meetings – List meetings hosted by current user */
    @Get()
    listMine(@Request() req: ExpressRequest & { user: any }) {
        return this.meetingsService.listUserMeetings(req.user.id);
    }

    /** GET /api/meetings/:code – Get meeting details by code (for join validation) */
    @Get(':code')
    findOne(@Param('code') code: string) {
        return this.meetingsService.findByCode(code);
    }
}
