import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createLogger } from '@platform/logger';
import { TargetType, TrackWatchTimeDto } from './dto/analytics.dto';

const logger = createLogger({ service: 'social-service:analytics' });

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAnalytics(targetType: TargetType, targetId: string, currentUserId: string) {
    logger.info(`Getting analytics for ${targetType} ${targetId}`, { currentUserId });

    switch (targetType) {
      case TargetType.POST:
        return this.getPostAnalytics(targetId, currentUserId);
      case TargetType.REEL:
        return this.getReelAnalytics(targetId, currentUserId);
      case TargetType.VIDEO:
        return this.getVideoAnalytics(targetId, currentUserId);
      case TargetType.NOVEL:
        return this.getNovelAnalytics(targetId, currentUserId);
      default:
        throw new NotFoundException('Target type không hợp lệ');
    }
  }

  async trackWatchTime(userId: string, dto: TrackWatchTimeDto) {
    if (dto.targetType === TargetType.REEL) {
      await this.prisma.reel.update({
        where: { id: dto.targetId },
        data: { totalWatchTime: { increment: dto.watchTimeSeconds } },
      }).catch(err => logger.error(`Failed to track reel watch time`, err));
    } else if (dto.targetType === TargetType.VIDEO) {
      await this.prisma.video.update({
        where: { id: dto.targetId },
        data: { totalWatchTime: { increment: dto.watchTimeSeconds } },
      }).catch(err => logger.error(`Failed to track video watch time`, err));
    }
    return { message: 'Watch time tracked successfully' };
  }

  // ── Specific Analytics ────────────────────────────────────

  private async getPostAnalytics(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.isDeleted) throw new NotFoundException('Post không tồn tại');
    if (post.authorId !== userId) throw new ForbiddenException('Bạn không có quyền xem analytics này');

    // Mặc định impressions = viewCount * 1.5 cho minh họa
    return {
      views: post.viewCount,
      impressions: Math.floor(post.viewCount * 1.5),
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      shareCount: post.shareCount,
      engagementRate: post.viewCount > 0
        ? ((post.likeCount + post.commentCount + post.shareCount) / post.viewCount) * 100
        : 0,
    };
  }

  private async getReelAnalytics(reelId: string, userId: string) {
    const reel = await this.prisma.reel.findUnique({
      where: { id: reelId },
      include: { _count: { select: { bookmarks: true } } },
    });
    if (!reel || reel.isDeleted) throw new NotFoundException('Reel không tồn tại');
    if (reel.authorId !== userId) throw new ForbiddenException('Bạn không có quyền xem analytics này');

    return {
      views: reel.viewCount,
      impressions: Math.floor(reel.viewCount * 1.2),
      likeCount: reel.likeCount,
      commentCount: reel.commentCount,
      shareCount: reel.shareCount,
      saves: reel._count.bookmarks,
      totalWatchTimeSeconds: reel.totalWatchTime,
      engagementRate: reel.viewCount > 0
        ? ((reel.likeCount + reel.commentCount + reel.shareCount + reel._count.bookmarks) / reel.viewCount) * 100
        : 0,
    };
  }

  private async getVideoAnalytics(videoId: string, userId: string) {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
      include: { _count: { select: { bookmarks: true } } },
    });
    if (!video || video.isDeleted) throw new NotFoundException('Video không tồn tại');
    if (video.authorId !== userId) throw new ForbiddenException('Bạn không có quyền xem analytics này');

    return {
      views: video.viewCount,
      impressions: Math.floor(video.viewCount * 1.3),
      likeCount: video.likeCount,
      commentCount: video.commentCount,
      shareCount: video.shareCount,
      saves: video._count.bookmarks,
      totalWatchTimeSeconds: video.totalWatchTime,
      engagementRate: video.viewCount > 0
        ? ((video.likeCount + video.commentCount + video.shareCount + video._count.bookmarks) / video.viewCount) * 100
        : 0,
    };
  }

  private async getNovelAnalytics(novelId: string, userId: string) {
    const novel = await this.prisma.novel.findUnique({
      where: { id: novelId },
      include: { _count: { select: { bookmarks: true } } },
    });
    if (!novel) throw new NotFoundException('Tiểu thuyết không tồn tại');
    if (novel.authorId !== userId) throw new ForbiddenException('Bạn không có quyền xem analytics này');

    return {
      views: novel.viewCount,
      impressions: Math.floor(novel.viewCount * 1.1), // Giả lập impressions
      followerCount: novel.followerCount,
      averageRating: novel.averageRating,
      ratingCount: novel.ratingCount,
      saves: novel._count.bookmarks,
      chapterCount: novel.chapterCount,
      engagementRate: novel.viewCount > 0
        ? ((novel.followerCount + novel.ratingCount + novel._count.bookmarks) / novel.viewCount) * 100
        : 0,
    };
  }
}
