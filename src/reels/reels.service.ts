import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createLogger } from '@platform/logger';
import {
  CreateReelDto,
  UpdateReelDto,
  ShareReelDto,
  ReelsQueryDto,
  FeedQueryDto,
  DiscoverReelsQueryDto,
} from './dto/reel.dto';
import { MediaResolverService } from '../common/services/media-resolver.service';
import { console } from 'inspector';

const logger = createLogger({ service: 'social-service:reels' });

@Injectable()
export class ReelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaResolver: MediaResolverService,
  ) { }

  // ── Helpers ───────────────────────────────────────────────
  private buildPagination(page: number, pageSize: number, totalItems: number) {
    const totalPages = Math.ceil(totalItems / pageSize);
    return {
      currentPage: page,
      totalPages,
      totalItems,
      itemsPerPage: pageSize,
      hasNext: page < totalPages,
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
      isPrivate: u.isPrivate,
    };
  }

  private mapReel(reel: any, currentUserId?: string, urlMap: Record<string, any> = {}) {
    const isLiked = currentUserId
      ? (reel.likes ?? []).some((l: any) => l.userId === currentUserId)
      : false;

    const isBookmarked = currentUserId
      ? (reel.bookmarks ?? []).some((b: any) => b.userId === currentUserId)
      : false;

    const videoUrls = reel.videoMediaId ? urlMap[reel.videoMediaId]?.data : null;
    const thumbUrls = reel.thumbnailMediaId ? urlMap[reel.thumbnailMediaId]?.data : null;
    return {
      id: reel.id,
      author: reel.author ? this.mapAuthor(reel.author, urlMap) : null,
      content: reel.content,
      videoMediaId: reel.videoMediaId,
      thumbnailMediaId: reel.thumbnailMediaId,
      // Resolved URLs for FE (backward-compatible field names)
      videoUrl: videoUrls?.hls || videoUrls?.original || null,
      fallbackUrl: videoUrls?.fallback || videoUrls?.original || null,
      thumbnailUrl: thumbUrls?.thumbnail || thumbUrls?.original || null,
      duration: reel.duration,
      hashtags: reel.hashtags,
      musicId: reel.musicId,
      likeCount: reel.likeCount,
      commentCount: reel.commentCount,
      shareCount: reel.shareCount,
      viewCount: reel.viewCount,
      isLikedByCurrentUser: isLiked,
      isBookmarkedByCurrentUser: isBookmarked,
      visibility: reel.visibility.toLowerCase(),
      createdAt: reel.createdAt,
      updatedAt: reel.updatedAt,
    };
  }

  private readonly reelInclude = {
    author: true,
    likes: { select: { userId: true } },
    bookmarks: { select: { userId: true } },
  };

  /** Collect all unique mediaIds from a list of reels (video, thumbnail, author avatar) */
  private collectMediaIds(reels: any[]): string[] {
    const ids = new Set<string>();
    for (const r of reels) {
      if (r.videoMediaId) ids.add(r.videoMediaId);
      if (r.thumbnailMediaId && r.thumbnailMediaId !== r.videoMediaId) ids.add(r.thumbnailMediaId);
      if (r.author?.avatarMediaId) ids.add(r.author.avatarMediaId);
    }
    return [...ids];
  }

  // ── Personal Feed (Following) ─────────────────────────────
  async getFollowingFeed(userId: string, page: number, pageSize: number) {
    logger.info('Getting following reels feed', { userId, page, pageSize });

    // Fanout on read approach: Get IDs of people the user follows
    const follows = await this.prisma.follow.findMany({
      where: { followerId: userId, status: 'ACCEPTED' },
      select: { followingId: true },
    });
    const followingIds = follows.map((f) => f.followingId);

    const authorIds = [userId, ...followingIds];

    const [total, reels] = await Promise.all([
      this.prisma.reel.count({
        where: {
          authorId: { in: authorIds },
          isDeleted: false,
          visibility: { not: 'PRIVATE' },
        },
      }),
      this.prisma.reel.findMany({
        where: {
          authorId: { in: authorIds },
          isDeleted: false,
          visibility: { not: 'PRIVATE' },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: this.reelInclude,
      }),
    ]);

    const urlMap = await this.mediaResolver.resolveBatch(this.collectMediaIds(reels));

    return {
      statusCode: 200,
      data: reels.map((r) => this.mapReel(r, userId, urlMap)),
      meta: { pagination: this.buildPagination(page, pageSize, total), timestamp: new Date().toISOString() },
    };
  }

  // ── Discover Feed (For You / Trending) ────────────────────
  async getDiscoverFeed(query: DiscoverReelsQueryDto, currentUserId?: string) {
    const { page = 1, pageSize = 10, filter = 'for-you' } = query;
    logger.info('Getting discover reels', { filter, page, pageSize });

    // Tradeoff: Basic 'trending' sorts by likeCount. 'for-you' defaults to latest for now.
    // Real 'for-you' would use a recommendation engine (Phase 10).
    const orderBy =
      filter === 'trending'
        ? [{ likeCount: 'desc' as const }, { createdAt: 'desc' as const }]
        : { createdAt: 'desc' as const };

    const [total, reels] = await Promise.all([
      this.prisma.reel.count({
        where: { isDeleted: false, visibility: 'PUBLIC' },
      }),
      this.prisma.reel.findMany({
        where: { isDeleted: false, visibility: 'PUBLIC' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: Array.isArray(orderBy) ? orderBy : [orderBy],
        include: this.reelInclude,
      }),
    ]);

    const urlMap = await this.mediaResolver.resolveBatch(this.collectMediaIds(reels));

    return {
      statusCode: 200,
      data: reels.map((r) => this.mapReel(r, currentUserId, urlMap)),
      meta: { pagination: this.buildPagination(page, pageSize, total), timestamp: new Date().toISOString() },
    };
  }

  // ── List Reels (filtered) ─────────────────────────────────
  async listReels(query: ReelsQueryDto, currentUserId?: string) {
    const { page = 1, pageSize = 10, authorId, hashtag } = query;
    logger.info('Listing reels', { query });

    const where: any = { isDeleted: false, visibility: 'PUBLIC' };
    if (authorId) where.authorId = authorId;
    if (hashtag) where.hashtags = { has: hashtag };

    const [total, reels] = await Promise.all([
      this.prisma.reel.count({ where }),
      this.prisma.reel.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: this.reelInclude,
      }),
    ]);

    const urlMap = await this.mediaResolver.resolveBatch(this.collectMediaIds(reels));

    return {
      statusCode: 200,
      data: reels.map((r) => this.mapReel(r, currentUserId, urlMap)),
      meta: { pagination: this.buildPagination(page, pageSize, total), timestamp: new Date().toISOString() },
    };
  }

  // ── Create Reel ───────────────────────────────────────────
  async createReel(authorId: string, dto: CreateReelDto) {
    logger.info('Creating reel', { authorId });

    // The client now provides the media IDs directly from Media Service.
    // We just store them without coupling to Media Service URLs.
    const finalVideoMediaId = dto.videoMediaId || dto.mediaId;

    // If no explicit thumbnailMediaId provided, fall back to the video's mediaId.
    // The media-service /access endpoint will return both the original and thumbnail URLs.
    const finalThumbnailMediaId = dto.thumbnailMediaId ?? finalVideoMediaId;

    if (!finalVideoMediaId) {
      throw new ForbiddenException('Video Media ID is required');
    }

    const reel = await this.prisma.reel.create({
      data: {
        authorId,
        content: dto.content,
        videoMediaId: finalVideoMediaId,
        thumbnailMediaId: finalThumbnailMediaId ?? null,
        duration: dto.duration ?? null,
        hashtags: this.extractHashtags(dto.content),
        musicId: dto.musicId ?? null,
        visibility: (dto.visibility ?? 'public').toUpperCase() as any,
      },
      include: this.reelInclude,
    });

    const urlMap = await this.mediaResolver.resolveBatch(this.collectMediaIds([reel]));
    return this.mapReel(reel, authorId, urlMap);
  }

  // ── Get Reel By ID ────────────────────────────────────────
  async getById(reelId: string, currentUserId?: string) {
    logger.info('Getting reel by id', { reelId });

    const reel = await this.prisma.reel.findUnique({
      where: { id: reelId },
      include: this.reelInclude,
    });

    if (!reel || reel.isDeleted) {
      throw new NotFoundException('Reel không tồn tại');
    }

    // Fire & forget view increment (Optimized: No wait)
    this.incrementView(reelId).catch((err) =>
      logger.error(`Failed to increment view for reel ${reelId}`, err),
    );

    return this.mapReel(reel, currentUserId);
  }

  // ── Increment View ────────────────────────────────────────
  private async incrementView(reelId: string) {
    await this.prisma.reel.update({
      where: { id: reelId },
      data: { viewCount: { increment: 1 } },
    });
  }

  // ── Update Reel ───────────────────────────────────────────
  async updateReel(reelId: string, authorId: string, dto: UpdateReelDto) {
    logger.info('Updating reel', { reelId, authorId });

    const reel = await this.prisma.reel.findUnique({ where: { id: reelId } });

    if (!reel || reel.isDeleted) {
      throw new NotFoundException('Reel không tồn tại');
    }
    if (reel.authorId !== authorId) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa reel này');
    }

    const updated = await this.prisma.reel.update({
      where: { id: reelId },
      data: {
        ...(dto.content !== undefined && {
          content: dto.content,
          hashtags: this.extractHashtags(dto.content),
        }),
        ...(dto.visibility !== undefined && {
          visibility: dto.visibility.toUpperCase() as any,
        }),
      },
      include: this.reelInclude,
    });

    return this.mapReel(updated, authorId);
  }

  // ── Delete Reel ───────────────────────────────────────────
  async deleteReel(reelId: string, authorId: string) {
    logger.info('Deleting reel', { reelId, authorId });

    const reel = await this.prisma.reel.findUnique({ where: { id: reelId } });

    if (!reel || reel.isDeleted) {
      throw new NotFoundException('Reel không tồn tại');
    }
    if (reel.authorId !== authorId) {
      throw new ForbiddenException('Bạn không có quyền xóa reel này');
    }

    await this.prisma.reel.update({
      where: { id: reelId },
      data: { isDeleted: true },
    });

    return null;
  }

  // ── Like / Unlike ─────────────────────────────────────────
  async likeReel(reelId: string, userId: string) {
    logger.info('Liking reel', { reelId, userId });

    const reel = await this.prisma.reel.findUnique({ where: { id: reelId } });
    if (!reel || reel.isDeleted) {
      throw new NotFoundException('Reel không tồn tại');
    }

    const existing = await this.prisma.reelLike.findUnique({
      where: {
        userId_reelId: { userId, reelId },
      },
    });

    if (!existing) {
      await this.prisma.$transaction(async (tx) => {
        await tx.reelLike.create({
          data: { userId, reelId },
        });
        await tx.reel.update({
          where: { id: reelId },
          data: { likeCount: { increment: 1 } },
        });
      });
    }

    const updated = await this.prisma.reel.findUnique({ where: { id: reelId } });
    return {
      likeCount: updated!.likeCount,
      isLikedByCurrentUser: true,
    };
  }

  async unlikeReel(reelId: string, userId: string) {
    logger.info('Unliking reel', { reelId, userId });

    const existing = await this.prisma.reelLike.findUnique({
      where: {
        userId_reelId: { userId, reelId },
      },
    });

    if (existing) {
      await this.prisma.$transaction(async (tx) => {
        await tx.reelLike.delete({
          where: {
            userId_reelId: { userId, reelId },
          },
        });
        await tx.reel.update({
          where: { id: reelId },
          data: { likeCount: { decrement: 1 } },
        });
      });
    }

    const updated = await this.prisma.reel.findUnique({ where: { id: reelId } });
    return {
      likeCount: updated!.likeCount,
      isLikedByCurrentUser: false,
    };
  }

  // ── Share Reel ────────────────────────────────────────────
  async shareReel(reelId: string, userId: string, dto: ShareReelDto) {
    logger.info('Sharing reel', { reelId, userId, dto });

    await this.prisma.reel.update({
      where: { id: reelId },
      data: { shareCount: { increment: 1 } },
    });

    return { message: 'Đã chia sẻ reel' };
  }

  // ── Analytics ─────────────────────────────────────────────
  async getReelAnalytics(reelId: string, userId: string) {
    logger.info('Getting reel analytics', { reelId, userId });

    const reel = await this.prisma.reel.findUnique({ where: { id: reelId } });
    if (!reel || reel.isDeleted) {
      throw new NotFoundException('Reel không tồn tại');
    }
    if (reel.authorId !== userId) {
      throw new ForbiddenException('Bạn không có quyền xem analytics của reel này');
    }

    return {
      views: reel.viewCount,
      impressions: reel.viewCount,
      reaches: Math.floor(reel.viewCount * 0.8),
      engagementRate:
        reel.viewCount > 0
          ? ((reel.likeCount + reel.commentCount + reel.shareCount) / reel.viewCount) * 100
          : 0,
      likeCount: reel.likeCount,
      commentCount: reel.commentCount,
      shareCount: reel.shareCount,
    };
  }

  // ── Util: extract hashtags from content ───────────────────
  private extractHashtags(content: string): string[] {
    const matches = content.match(/#[\w\u00C0-\u024F]+/g) ?? [];
    return [...new Set(matches.map((h) => h.slice(1).toLowerCase()))];
  }
}
