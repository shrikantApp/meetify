import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository, In } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { NotificationsGateway } from './notifications.gateway';
// import * as webpush from 'web-push'; // Uncomment when VAPID keys are configured

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationsRepo: Repository<Notification>,
    private readonly notificationsGateway: NotificationsGateway,
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

  async getNotifications(
    userId: string,
    query: { status?: 'all' | 'read' | 'unread'; page?: number; limit?: number; type?: NotificationType },
  ) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const where: FindOptionsWhere<Notification> = { userId };
    if (query.status === 'read') where.isRead = true;
    if (query.status === 'unread' || !query.status) where.isRead = false;
    if (query.status === 'all') delete where.isRead;
    if (query.type) where.type = query.type;

    const [items, total] = await this.notificationsRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit, hasMore: page * limit < total };
  }

  async getUnreadNotifications(userId: string): Promise<Notification[]> {
    const result = await this.getNotifications(userId, { status: 'unread', page: 1, limit: 50 });
    return result.items;
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationsRepo.count({ where: { userId, isRead: false } });
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
    const unreadCount = await this.getUnreadCount(data.userId);
    this.notificationsGateway.emitToUser(data.userId, 'notification.created', saved);
    this.notificationsGateway.emitToUser(data.userId, 'notification.unread_count.updated', { count: unreadCount });
    return saved;
  }

  async markAsRead(userId: string, notificationIds: string[]): Promise<number> {
    if (!notificationIds.length) return this.getUnreadCount(userId);
    await this.notificationsRepo.update(
      { userId, id: In(notificationIds) },
      { isRead: true }
    );
    const unreadCount = await this.getUnreadCount(userId);
    this.notificationsGateway.emitToUser(userId, 'notification.read', { notificationIds });
    this.notificationsGateway.emitToUser(userId, 'notification.unread_count.updated', { count: unreadCount });
    return unreadCount;
  }

  async markAllAsRead(userId: string): Promise<number> {
    await this.notificationsRepo.update({ userId, isRead: false }, { isRead: true });
    const unreadCount = await this.getUnreadCount(userId);
    this.notificationsGateway.emitToUser(userId, 'notification.read', { all: true });
    this.notificationsGateway.emitToUser(userId, 'notification.unread_count.updated', { count: unreadCount });
    return unreadCount;
  }

  async markOneAsRead(userId: string, id: string): Promise<Notification | null> {
    await this.markAsRead(userId, [id]);
    return this.notificationsRepo.findOne({ where: { id, userId } });
  }

  async markOneAsUnread(userId: string, id: string): Promise<Notification | null> {
    await this.notificationsRepo.update({ id, userId }, { isRead: false });
    const unreadCount = await this.getUnreadCount(userId);
    this.notificationsGateway.emitToUser(userId, 'notification.unread_count.updated', { count: unreadCount });
    return this.notificationsRepo.findOne({ where: { id, userId } });
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
