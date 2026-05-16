import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
// import * as webpush from 'web-push'; // Uncomment when VAPID keys are configured

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationsRepo: Repository<Notification>,
  ) {
    /* 
    // Initialize Web Push
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL || 'mailto:test@test.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    */
  }

  async getUnreadNotifications(userId: string): Promise<Notification[]> {
    return this.notificationsRepo.find({
      where: { userId, isRead: false },
      order: { createdAt: 'DESC' },
    });
  }

  async createNotification(data: {
    userId: string;
    type: NotificationType;
    title: string;
    body?: string;
    referenceId?: string;
    referenceType?: string;
    metadata?: any;
  }): Promise<Notification> {
    const notification = this.notificationsRepo.create(data);
    const saved = await this.notificationsRepo.save(notification);
    
    // Here we would trigger web-push and/or socket emission
    // this.sendPushNotification(userId, title, body);
    
    return saved;
  }

  async markAsRead(userId: string, notificationIds: string[]): Promise<void> {
    if (!notificationIds.length) return;
    await this.notificationsRepo.update(
      { userId, id: In(notificationIds) },
      { isRead: true }
    );
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationsRepo.update({ userId, isRead: false }, { isRead: true });
  }

  /*
  async savePushSubscription(userId: string, subscription: any) {
    // Save to user or redis
  }

  private async sendPushNotification(userId: string, title: string, body?: string) {
    // 1. Get user subscriptions
    // 2. webpush.sendNotification(sub, payload)
  }
  */
}
