import { Controller, Get, Patch, Body, UseGuards, Req, Post } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(@Req() req: any) {
    const userId = req.user.id;
    return this.notificationsService.getUnreadNotifications(userId);
  }

  @Patch('read')
  async markRead(@Req() req: any, @Body() body: { notificationIds?: string[] }) {
    const userId = req.user.id;
    if (body.notificationIds && body.notificationIds.length > 0) {
      await this.notificationsService.markAsRead(userId, body.notificationIds);
    } else {
      await this.notificationsService.markAllAsRead(userId);
    }
    return { success: true };
  }

  @Post('subscribe')
  async subscribePush(@Req() req: any, @Body() body: { subscription: any }) {
    // const userId = req.user.id;
    // await this.notificationsService.savePushSubscription(userId, body.subscription);
    return { success: true, message: 'Web push configured (mock)' };
  }
}
