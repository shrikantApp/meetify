import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

type AuthenticatedRequest = ExpressRequest & { user: { id: string } };

@UseGuards(JwtAuthGuard)
@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  /** POST /api/meetings – Create a new meeting */
  @Post()
  create(
    @Body() dto: CreateMeetingDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.meetingsService.createMeeting(dto, req.user as any);
  }

  /** GET /api/meetings – List meetings hosted by current user */
  @Get()
  listMine(@Request() req: AuthenticatedRequest) {
    return this.meetingsService.listUserMeetings(req.user.id);
  }

  /** GET /api/meetings/:code – Get meeting details by code */
  @Get(':code')
  findOne(@Param('code') code: string) {
    return this.meetingsService.findByCode(code);
  }

  /** PATCH /api/meetings/:code – Update meeting settings */
  @Patch(':code')
  update(
    @Param('code') code: string,
    @Body() body: { lobbyEnabled?: boolean },
    @Request() req: AuthenticatedRequest,
  ) {
    return this.meetingsService.updateMeeting(code, req.user.id, body);
  }

  /** GET /api/meetings/:code/messages – Get historical chat messages */
  @Get(':code/messages')
  getMessages(
    @Param('code') code: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.meetingsService.getMeetingMessages(code, req.user.id);
  }
}


