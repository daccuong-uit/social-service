import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createLogger } from '@platform/logger';
import {
  CreateNovelDto,
  UpdateNovelDto,
  CreateChapterDto,
  UpdateChapterDto,
  RateNovelDto,
  UpdateReadingProgressDto,
  NovelsQueryDto,
  PaginationQueryDto,
} from './dto/novel.dto';

import { MediaResolverService } from '../common/services/media-resolver.service';

const logger = createLogger({ service: 'social-service:novels' });

@Injectable()
export class NovelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaResolver: MediaResolverService,
  ) {}

  private buildPagination(page: number, pageSize: number, totalItems: number) {
    return {
      currentPage: page,
      totalPages: Math.ceil(totalItems / pageSize),
      totalItems,
      itemsPerPage: pageSize,
      hasNext: page < Math.ceil(totalItems / pageSize),
    };
  }

  private mapAuthor(u: any, urlMap: Record<string, any> = {}) {
    const avatarUrls = u.avatarMediaId ? urlMap[u.avatarMediaId]?.data : null;
    return {
      id: u.userId,
      username: u.username,
      displayName: u.displayName,
      avatarMediaId: u.avatarMediaId,
      avatarUrl: avatarUrls?.thumbnail || avatarUrls?.original || null,
      isVerified: u.isVerified,
    };
  }

  private mapNovel(novel: any, currentUserId?: string, urlMap: Record<string, any> = {}) {
    const isFollowed = currentUserId
      ? (novel.follows ?? []).some((f: any) => f.userId === currentUserId)
      : false;

    const coverUrls = novel.coverMediaId ? urlMap[novel.coverMediaId]?.data : null;

    return {
      id: novel.id,
      title: novel.title,
      synopsis: novel.synopsis,
      coverMediaId: novel.coverMediaId,
      coverUrl: coverUrls?.original || null,
      genres: novel.genres,
      tags: novel.tags,
      status: novel.status.toLowerCase(),
      visibility: novel.visibility.toLowerCase(),
      averageRating: novel.averageRating,
      ratingCount: novel.ratingCount,
      viewCount: novel.viewCount,
      followerCount: novel.followerCount,
      chapterCount: novel.chapterCount,
      createdAt: novel.createdAt,
      author: novel.author ? this.mapAuthor(novel.author, urlMap) : null,
      isFollowedByCurrentUser: isFollowed,
    };
  }

  private collectNovelMediaIds(novels: any[]): string[] {
    const ids = new Set<string>();
    for (const n of novels) {
      if (n.coverMediaId) ids.add(n.coverMediaId);
      if (n.author?.avatarMediaId) ids.add(n.author.avatarMediaId);
    }
    return [...ids];
  }

  private readonly novelInclude = {
    author: true,
    follows: { select: { userId: true } },
  };

  // ── 1. Novels CRUD ────────────────────────────────────────

  async listNovels(query: NovelsQueryDto, currentUserId?: string) {
    const { page = 1, pageSize = 20, authorId, genre, tag, status } = query;
    const where: any = { visibility: 'PUBLIC' };
    if (authorId) where.authorId = authorId;
    if (genre) where.genres = { has: genre };
    if (tag) where.tags = { has: tag };
    if (status) where.status = status.toUpperCase();

    const [total, novels] = await Promise.all([
      this.prisma.novel.count({ where }),
      this.prisma.novel.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: this.novelInclude,
      }),
    ]);

    const urlMap = await this.mediaResolver.resolveBatch(this.collectNovelMediaIds(novels));

    return {
      statusCode: 200,
      data: novels.map(n => this.mapNovel(n, currentUserId, urlMap)),
      meta: { pagination: this.buildPagination(page, pageSize, total), timestamp: new Date().toISOString() },
    };
  }

  async createNovel(authorId: string, dto: CreateNovelDto) {
    const novel = await this.prisma.novel.create({
      data: {
        authorId,
        title: dto.title,
        synopsis: dto.synopsis,
        coverMediaId: dto.coverMediaId,
        genres: dto.genres ?? [],
        tags: dto.tags ?? [],
        status: (dto.status ?? 'ONGOING').toUpperCase() as any,
        visibility: (dto.visibility ?? 'PUBLIC').toUpperCase() as any,
      },
      include: this.novelInclude,
    });
    const urlMap = await this.mediaResolver.resolveBatch(this.collectNovelMediaIds([novel]));
    return this.mapNovel(novel, authorId, urlMap);
  }

  async getNovelById(novelId: string, currentUserId?: string) {
    const novel = await this.prisma.novel.findUnique({
      where: { id: novelId },
      include: this.novelInclude,
    });

    if (!novel) throw new NotFoundException('Tiểu thuyết không tồn tại');
    if (novel.visibility === 'PRIVATE' && novel.authorId !== currentUserId) {
      throw new ForbiddenException('Không có quyền truy cập');
    }

    // Tăng lượt view (Fire & forget)
    this.prisma.novel.update({
      where: { id: novelId },
      data: { viewCount: { increment: 1 } },
    }).catch(err => logger.error(`View increment fail: ${novelId}`, err));

    const urlMap = await this.mediaResolver.resolveBatch(this.collectNovelMediaIds([novel]));
    return this.mapNovel(novel, currentUserId, urlMap);
  }

  async updateNovel(novelId: string, authorId: string, dto: UpdateNovelDto) {
    const novel = await this.prisma.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundException('Tiểu thuyết không tồn tại');
    if (novel.authorId !== authorId) throw new ForbiddenException('Không có quyền');

    const updated = await this.prisma.novel.update({
      where: { id: novelId },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.synopsis !== undefined && { synopsis: dto.synopsis }),
        ...(dto.coverMediaId !== undefined && { coverMediaId: dto.coverMediaId }),
        ...(dto.genres && { genres: dto.genres }),
        ...(dto.tags && { tags: dto.tags }),
        ...(dto.status && { status: dto.status.toUpperCase() as any }),
        ...(dto.visibility && { visibility: dto.visibility.toUpperCase() as any }),
      },
      include: this.novelInclude,
    });

    const urlMap = await this.mediaResolver.resolveBatch(this.collectNovelMediaIds([updated]));
    return this.mapNovel(updated, authorId, urlMap);
  }

  async deleteNovel(novelId: string, authorId: string) {
    const novel = await this.prisma.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundException('Tiểu thuyết không tồn tại');
    if (novel.authorId !== authorId) throw new ForbiddenException('Không có quyền');

    await this.prisma.novel.delete({ where: { id: novelId } });
    return null;
  }

  // ── 2. Chapters ───────────────────────────────────────────

  async listChapters(novelId: string, query: PaginationQueryDto, currentUserId?: string) {
    const { page = 1, pageSize = 50 } = query;
    const novel = await this.prisma.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundException('Tiểu thuyết không tồn tại');
    if (novel.visibility === 'PRIVATE' && novel.authorId !== currentUserId) {
      throw new ForbiddenException('Không có quyền truy cập');
    }

    const [total, chapters] = await Promise.all([
      this.prisma.chapter.count({ where: { novelId } }),
      this.prisma.chapter.findMany({
        where: { novelId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { orderIndex: 'asc' },
        select: { id: true, title: true, orderIndex: true, viewCount: true, commentCount: true, createdAt: true },
      }),
    ]);

    return {
      statusCode: 200,
      data: chapters,
      meta: { pagination: this.buildPagination(page, pageSize, total), timestamp: new Date().toISOString() },
    };
  }

  async createChapter(novelId: string, authorId: string, dto: CreateChapterDto) {
    const novel = await this.prisma.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundException('Tiểu thuyết không tồn tại');
    if (novel.authorId !== authorId) throw new ForbiddenException('Không có quyền');

    const result = await this.prisma.$transaction(async (tx) => {
      const chapter = await tx.chapter.create({
        data: {
          novelId,
          title: dto.title,
          content: dto.content,
          orderIndex: novel.chapterCount + 1,
        },
      });
      await tx.novel.update({
        where: { id: novelId },
        data: { chapterCount: { increment: 1 } },
      });
      return chapter;
    });

    return result;
  }

  async getChapterById(novelId: string, chapterId: string, currentUserId?: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { novel: { select: { authorId: true, visibility: true } } },
    });

    if (!chapter || chapter.novelId !== novelId) {
      throw new NotFoundException('Chương không tồn tại');
    }
    if (chapter.novel.visibility === 'PRIVATE' && chapter.novel.authorId !== currentUserId) {
      throw new ForbiddenException('Không có quyền truy cập');
    }

    // Tăng lượt view (Fire & forget)
    this.prisma.chapter.update({
      where: { id: chapterId },
      data: { viewCount: { increment: 1 } },
    }).catch(err => logger.error(`Chapter view increment fail: ${chapterId}`, err));

    return {
      id: chapter.id,
      novelId: chapter.novelId,
      title: chapter.title,
      content: chapter.content,
      orderIndex: chapter.orderIndex,
      viewCount: chapter.viewCount,
      commentCount: chapter.commentCount,
      createdAt: chapter.createdAt,
    };
  }

  async updateChapter(novelId: string, chapterId: string, authorId: string, dto: UpdateChapterDto) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { novel: { select: { authorId: true } } },
    });

    if (!chapter || chapter.novelId !== novelId) throw new NotFoundException('Chương không tồn tại');
    if (chapter.novel.authorId !== authorId) throw new ForbiddenException('Không có quyền');

    return this.prisma.chapter.update({
      where: { id: chapterId },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.content && { content: dto.content }),
      },
      select: { id: true, novelId: true, title: true, orderIndex: true, createdAt: true, updatedAt: true },
    });
  }

  async deleteChapter(novelId: string, chapterId: string, authorId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { novel: { select: { authorId: true } } },
    });

    if (!chapter || chapter.novelId !== novelId) throw new NotFoundException('Chương không tồn tại');
    if (chapter.novel.authorId !== authorId) throw new ForbiddenException('Không có quyền');

    await this.prisma.$transaction(async (tx) => {
      await tx.chapter.delete({ where: { id: chapterId } });
      await tx.novel.update({
        where: { id: novelId },
        data: { chapterCount: { decrement: 1 } },
      });
      // Optionally, reorder remaining chapters could be done here or in a background job
    });

    return null;
  }

  // ── 3. Follow Novel ───────────────────────────────────────

  async followNovel(novelId: string, userId: string) {
    const novel = await this.prisma.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundException('Tiểu thuyết không tồn tại');

    const existing = await this.prisma.novelFollow.findUnique({
      where: { userId_novelId: { userId, novelId } },
    });

    if (!existing) {
      await this.prisma.$transaction(async (tx) => {
        await tx.novelFollow.create({ data: { userId, novelId } });
        await tx.novel.update({ where: { id: novelId }, data: { followerCount: { increment: 1 } } });
      });
    }

    return { message: 'Đã theo dõi tiểu thuyết' };
  }

  async unfollowNovel(novelId: string, userId: string) {
    const existing = await this.prisma.novelFollow.findUnique({
      where: { userId_novelId: { userId, novelId } },
    });

    if (existing) {
      await this.prisma.$transaction(async (tx) => {
        await tx.novelFollow.delete({ where: { userId_novelId: { userId, novelId } } });
        await tx.novel.update({ where: { id: novelId }, data: { followerCount: { decrement: 1 } } });
      });
    }

    return { message: 'Đã hủy theo dõi tiểu thuyết' };
  }

  // ── 4. Rating ─────────────────────────────────────────────

  async rateNovel(novelId: string, userId: string, dto: RateNovelDto) {
    const novel = await this.prisma.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundException('Tiểu thuyết không tồn tại');

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.novelRating.findUnique({
        where: { userId_novelId: { userId, novelId } },
      });

      if (existing) {
        await tx.novelRating.update({
          where: { id: existing.id },
          data: { rating: dto.rating, review: dto.review },
        });
      } else {
        await tx.novelRating.create({
          data: { userId, novelId, rating: dto.rating, review: dto.review },
        });
      }

      // Recalculate average rating (simple logic for now, should be optimized for scale)
      const aggregates = await tx.novelRating.aggregate({
        where: { novelId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await tx.novel.update({
        where: { id: novelId },
        data: {
          averageRating: aggregates._avg.rating ?? 0,
          ratingCount: aggregates._count.rating ?? 0,
        },
      });
    });

    return { message: 'Đã đánh giá thành công' };
  }

  // ── 5. Reading Progress ───────────────────────────────────

  async updateProgress(novelId: string, chapterId: string, userId: string, dto: UpdateReadingProgressDto) {
    await this.prisma.readingProgress.upsert({
      where: { userId_novelId: { userId, novelId } },
      create: {
        userId,
        novelId,
        chapterId,
        progressPercent: dto.progressPercent,
      },
      update: {
        chapterId,
        progressPercent: dto.progressPercent,
        lastReadAt: new Date(),
      },
    });

    return { message: 'Đã lưu tiến trình đọc' };
  }

  async getMyLibrary(userId: string, query: PaginationQueryDto) {
    const { page = 1, pageSize = 20 } = query;
    const [total, progresses] = await Promise.all([
      this.prisma.readingProgress.count({ where: { userId } }),
      this.prisma.readingProgress.findMany({
        where: { userId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { lastReadAt: 'desc' },
        include: {
          chapter: { select: { id: true, title: true, orderIndex: true } },
          user: { select: { novels: { where: { id: { in: [] } /* Trick to get novel via manual join if needed, but we can query novel directly */ } } } } // Actually, novel relation isn't direct here, we should fetch novel.
        },
      }),
    ]);

    // Lấy thông tin novels
    const novelIds = progresses.map(p => p.novelId);
    const novels = await this.prisma.novel.findMany({
      where: { id: { in: novelIds } },
      select: { id: true, title: true, coverMediaId: true, author: { select: { displayName: true } } },
    });
    const novelMap = new Map(novels.map(n => [n.id, n]));

    return {
      data: progresses.map(p => ({
        novel: novelMap.get(p.novelId),
        currentChapter: p.chapter,
        progressPercent: p.progressPercent,
        lastReadAt: p.lastReadAt,
      })),
      meta: { pagination: this.buildPagination(page, pageSize, total) },
    };
  }
}
