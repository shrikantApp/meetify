import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Req,
  Post,
  Query,
  Param,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationType } from './entities/notification.entity';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @Req() req: any,
    @Query('status') status?: 'all' | 'read' | 'unread',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: NotificationType,
  ) {
    return this.notificationsService.getNotifications(req.user.id, {
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      type,
    });
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    return {
      count: await this.notificationsService.getUnreadCount(req.user.id),
    };
  }

  @Patch('read')
  async markRead(
    @Req() req: any,
    @Body() body: { notificationIds?: string[] },
  ) {
    const userId = req.user.id;
    if (body.notificationIds && body.notificationIds.length > 0) {
      const unreadCount = await this.notificationsService.markAsRead(
        userId,
        body.notificationIds,
      );
      return { success: true, unreadCount };
    } else {
      const unreadCount = await this.notificationsService.markAllAsRead(userId);
      return { success: true, unreadCount };
    }
  }

  @Patch(':id/read')
  async markOneRead(@Req() req: any, @Param('id') id: string) {
    return this.notificationsService.markOneAsRead(req.user.id, id);
  }

  @Patch(':id/unread')
  async markOneUnread(@Req() req: any, @Param('id') id: string) {
    return this.notificationsService.markOneAsUnread(req.user.id, id);
  }

  @Post('subscribe')
  async subscribePush(@Req() req: any, @Body() body: { subscription: any }) {
    // const userId = req.user.id;
    // await this.notificationsService.savePushSubscription(userId, body.subscription);
    return { success: true, message: 'Web push configured (mock)' };
  }
}
