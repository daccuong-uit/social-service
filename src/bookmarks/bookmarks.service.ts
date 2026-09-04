import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createLogger } from '@platform/logger';
import { AddBookmarkDto, RemoveBookmarkDto, BookmarksQueryDto } from './dto/bookmark.dto';

const logger = createLogger({ service: 'social-service:bookmarks' });

@Injectable()
export class BookmarksService {
  constructor(private readonly prisma: PrismaService) {}

  private buildPagination(page: number, pageSize: number, totalItems: number) {
    const totalPages = Math.ceil(totalItems / pageSize);
    return { currentPage: page, totalPages, totalItems, itemsPerPage: pageSize, hasNext: page < totalPages };
  }

  async getBookmarks(userId: string, query: BookmarksQueryDto) {
    const { page = 1, pageSize = 20, type } = query;
    logger.info('Getting bookmarks', { userId, type });

    const where: any = { userId };
    if (type) where.targetType = type.toUpperCase();

    const [total, bookmarks] = await Promise.all([
      this.prisma.bookmark.count({ where }),
      this.prisma.bookmark.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { post: { include: { author: true } } },
      }),
    ]);

    return {
      statusCode: 200,
      data: bookmarks.map((b) => ({
        id: b.id,
        targetId: b.targetId,
        targetType: b.targetType.toLowerCase(),
        createdAt: b.createdAt,
        post: b.post
          ? {
              id: b.post.id,
              content: b.post.content,
              type: b.post.type.toLowerCase(),
              author: { id: b.post.author.userId, username: b.post.author.username, displayName: b.post.author.displayName, avatarMediaId: b.post.author.avatarMediaId },
              createdAt: b.post.createdAt,
            }
          : null,
      })),
      meta: { pagination: this.buildPagination(page, pageSize, total), timestamp: new Date().toISOString() },
    };
  }

  async addBookmark(userId: string, dto: AddBookmarkDto) {
    logger.info('Adding bookmark', { userId, ...dto });

    const existing = await this.prisma.bookmark.findUnique({
      where: { userId_targetId_targetType: { userId, targetId: dto.targetId, targetType: dto.targetType.toUpperCase() as any } },
    });

    if (existing) throw new ConflictException('Đã lưu mục này trước đó');

    await this.prisma.bookmark.create({
      data: { userId, targetId: dto.targetId, targetType: dto.targetType.toUpperCase() as any },
    });

    return { message: 'Đã lưu thành công' };
  }

  async removeBookmark(userId: string, dto: RemoveBookmarkDto) {
    logger.info('Removing bookmark', { userId, ...dto });

    await this.prisma.bookmark.deleteMany({
      where: { userId, targetId: dto.targetId, targetType: dto.targetType.toUpperCase() as any },
    });

    return { message: 'Đã bỏ lưu thành công' };
  }
}
