import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createLogger } from '@platform/logger';
import { NotificationsQueryDto } from './dto/notification.dto';

const logger = createLogger({ service: 'social-service:notifications' });

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildPagination(page: number, pageSize: number, totalItems: number) {
    const totalPages = Math.ceil(totalItems / pageSize);
    return { currentPage: page, totalPages, totalItems, itemsPerPage: pageSize, hasNext: page < totalPages };
  }

  private mapNotification(n: any) {
    return {
      id: n.id,
      type: n.type.toLowerCase(),
      actorId: n.actorId,
      targetId: n.targetId,
      targetType: n.targetType,
      content: n.content,
      isRead: n.isRead,
      createdAt: n.createdAt,
    };
  }

  // ── List ──────────────────────────────────────────────────
  async list(userId: string, query: NotificationsQueryDto) {
    const { page = 1, pageSize = 20, unreadOnly } = query;
    logger.info('Getting notifications', { userId, unreadOnly });

    const where: any = { userId };
    if (unreadOnly) where.isRead = false;

    const [total, notifications] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      statusCode: 200,
      data: notifications.map((n) => this.mapNotification(n)),
      meta: { pagination: this.buildPagination(page, pageSize, total), timestamp: new Date().toISOString() },
    };
  }

  // ── Unread count ──────────────────────────────────────────
  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { unreadCount: count };
  }

  // ── Mark as read ──────────────────────────────────────────
  async markAsRead(userId: string, notificationId: string) {
    logger.info('Marking notification as read', { userId, notificationId });

    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });

    return { message: 'Đã đánh dấu đã đọc' };
  }

  // ── Mark all as read ──────────────────────────────────────
  async markAllAsRead(userId: string) {
    logger.info('Marking all notifications as read', { userId });

    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { message: 'Đã đánh dấu tất cả là đã đọc' };
  }

  // ── Delete one ────────────────────────────────────────────
  async deleteOne(userId: string, notificationId: string) {
    await this.prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
    return null;
  }

  // ── Internal: push notification (used by other services) ──
  async push(data: {
    userId: string;
    actorId?: string;
    type: string;
    targetId?: string;
    targetType?: string;
    content?: string;
  }) {
    await this.prisma.notification.create({
      data: {
        userId: data.userId,
        actorId: data.actorId,
        type: data.type.toUpperCase() as any,
        targetId: data.targetId,
        targetType: data.targetType,
        content: data.content,
      },
    });
  }
}
