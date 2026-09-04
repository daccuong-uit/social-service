import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createLogger } from '@platform/logger';
import {
  CreateVideoDto,
  UpdateVideoDto,
  CreatePlaylistDto,
  UpdatePlaylistDto,
  AddToPlaylistDto,
  UpdateHistoryDto,
  VideosQueryDto,
  PaginationQueryDto,
} from './dto/video.dto';

import { MediaResolverService } from '../common/services/media-resolver.service';

const logger = createLogger({ service: 'social-service:videos' });

@Injectable()
export class VideosService {
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

  private mapVideo(video: any, currentUserId?: string, urlMap: Record<string, any> = {}) {
    const isLiked = currentUserId
      ? (video.reactions ?? []).some(
          (r: any) => r.userId === currentUserId && r.type === 'LIKE',
        )
      : false;

    const isBookmarked = currentUserId
      ? (video.bookmarks ?? []).some((b: any) => b.userId === currentUserId)
      : false;

    const videoUrls = video.videoMediaId ? urlMap[video.videoMediaId]?.data : null;
    const thumbUrls = video.thumbnailMediaId ? urlMap[video.thumbnailMediaId]?.data : null;

    return {
      id: video.id,
      title: video.title,
      description: video.description,
      videoMediaId: video.videoMediaId,
      thumbnailMediaId: video.thumbnailMediaId,
      videoUrl: videoUrls?.hls || videoUrls?.original || null,
      thumbnailUrl: thumbUrls?.thumbnail || thumbUrls?.original || null,
      duration: video.duration,
      hashtags: video.hashtags,
      likeCount: video.likeCount,
      commentCount: video.commentCount,
      shareCount: video.shareCount,
      viewCount: video.viewCount,
      visibility: video.visibility.toLowerCase(),
      createdAt: video.createdAt,
      author: video.author ? this.mapAuthor(video.author, urlMap) : null,
      isLikedByCurrentUser: isLiked,
      isBookmarkedByCurrentUser: isBookmarked,
    };
  }

  private collectVideoMediaIds(videos: any[]): string[] {
    const ids = new Set<string>();
    for (const v of videos) {
      if (v.videoMediaId) ids.add(v.videoMediaId);
      if (v.thumbnailMediaId && v.thumbnailMediaId !== v.videoMediaId) ids.add(v.thumbnailMediaId);
      if (v.author?.avatarMediaId) ids.add(v.author.avatarMediaId);
    }
    return [...ids];
  }

  private readonly videoInclude = {
    author: true,
    reactions: { select: { userId: true, type: true } },
    bookmarks: { select: { userId: true } },
  };

  // ── 1. Videos CRUD ────────────────────────────────────────

  async listVideos(query: VideosQueryDto, currentUserId?: string) {
    const { page = 1, pageSize = 20, authorId, hashtag } = query;
    const where: any = { isDeleted: false, visibility: 'PUBLIC' };
    if (authorId) where.authorId = authorId;
    if (hashtag) where.hashtags = { has: hashtag };

    const [total, videos] = await Promise.all([
      this.prisma.video.count({ where }),
      this.prisma.video.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: this.videoInclude,
      }),
    ]);

    const urlMap = await this.mediaResolver.resolveBatch(this.collectVideoMediaIds(videos));
    return {
      data: videos.map((v) => this.mapVideo(v, currentUserId, urlMap)),
      meta: { pagination: this.buildPagination(page, pageSize, total) },
    };
  }

  async createVideo(authorId: string, dto: CreateVideoDto) {
    logger.info('Creating video', { authorId });
    const video = await this.prisma.video.create({
      data: {
        authorId,
        title: dto.title,
        description: dto.description,
        videoMediaId: dto.videoMediaId,
        thumbnailMediaId: dto.thumbnailMediaId,
        duration: dto.duration,
        hashtags: this.extractHashtags(dto.title + ' ' + (dto.description ?? '')),
        visibility: (dto.visibility ?? 'PUBLIC').toUpperCase() as any,
      },
      include: this.videoInclude,
    });
    const urlMap = await this.mediaResolver.resolveBatch(this.collectVideoMediaIds([video]));
    return this.mapVideo(video, authorId, urlMap);
  }

  async getVideoById(videoId: string, currentUserId?: string) {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
      include: this.videoInclude,
    });

    if (!video || video.isDeleted) throw new NotFoundException('Video không tồn tại');

    // Fire and forget view increment
    this.incrementView(videoId).catch(err => logger.error(`View increment fail: ${videoId}`, err));

    const urlMap = await this.mediaResolver.resolveBatch(this.collectVideoMediaIds([video]));
    return this.mapVideo(video, currentUserId, urlMap);
  }

  async updateVideo(videoId: string, authorId: string, dto: UpdateVideoDto) {
    const video = await this.prisma.video.findUnique({ where: { id: videoId } });
    if (!video || video.isDeleted) throw new NotFoundException('Video không tồn tại');
    if (video.authorId !== authorId) throw new ForbiddenException('Không có quyền');

    const updated = await this.prisma.video.update({
      where: { id: videoId },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.thumbnailMediaId !== undefined && { thumbnailMediaId: dto.thumbnailMediaId }),
        ...(dto.visibility && { visibility: dto.visibility.toUpperCase() as any }),
      },
      include: this.videoInclude,
    });

    // Update hashtags if title or desc changed
    if (dto.title || dto.description !== undefined) {
      const hashtags = this.extractHashtags(updated.title + ' ' + (updated.description ?? ''));
      await this.prisma.video.update({ where: { id: videoId }, data: { hashtags } });
      updated.hashtags = hashtags;
    }

    const urlMap = await this.mediaResolver.resolveBatch(this.collectVideoMediaIds([updated]));
    return this.mapVideo(updated, authorId, urlMap);
  }

  async deleteVideo(videoId: string, authorId: string) {
    const video = await this.prisma.video.findUnique({ where: { id: videoId } });
    if (!video || video.isDeleted) throw new NotFoundException('Video không tồn tại');
    if (video.authorId !== authorId) throw new ForbiddenException('Không có quyền');

    await this.prisma.video.update({ where: { id: videoId }, data: { isDeleted: true } });
    return null;
  }

  private async incrementView(videoId: string) {
    await this.prisma.video.update({
      where: { id: videoId },
      data: { viewCount: { increment: 1 } },
    });
  }

  // ── 2. Playlists ──────────────────────────────────────────

  async getPlaylists(userId: string, query: PaginationQueryDto) {
    const { page = 1, pageSize = 20 } = query;
    const [total, playlists] = await Promise.all([
      this.prisma.playlist.count({ where: { authorId: userId } }),
      this.prisma.playlist.findMany({
        where: { authorId: userId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      statusCode: 200,
      data: playlists,
      meta: { pagination: this.buildPagination(page, pageSize, total), timestamp: new Date().toISOString() },
    };
  }

  async createPlaylist(authorId: string, dto: CreatePlaylistDto) {
    return this.prisma.playlist.create({
      data: {
        authorId,
        name: dto.name,
        description: dto.description,
        visibility: (dto.visibility ?? 'PUBLIC').toUpperCase() as any,
      },
    });
  }

  async getPlaylistById(playlistId: string, currentUserId?: string) {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
      include: {
        author: true,
        items: {
          orderBy: { orderIndex: 'asc' },
          include: { video: { include: this.videoInclude } },
        },
      },
    });

    if (!playlist) throw new NotFoundException('Playlist không tồn tại');
    if (playlist.visibility === 'PRIVATE' && playlist.authorId !== currentUserId) {
      throw new ForbiddenException('Không có quyền xem playlist này');
    }

    const allVideos = playlist.items.filter(item => !item.video.isDeleted).map(i => i.video);
    const urlMap = await this.mediaResolver.resolveBatch(this.collectVideoMediaIds([...allVideos, playlist.author ? { author: playlist.author } : {}]));

    return {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      visibility: playlist.visibility.toLowerCase(),
      itemCount: playlist.itemCount,
      author: this.mapAuthor(playlist.author, urlMap),
      videos: allVideos.map(video => this.mapVideo(video, currentUserId, urlMap)),
    };
  }

  async updatePlaylist(playlistId: string, authorId: string, dto: UpdatePlaylistDto) {
    const playlist = await this.prisma.playlist.findUnique({ where: { id: playlistId } });
    if (!playlist) throw new NotFoundException('Playlist không tồn tại');
    if (playlist.authorId !== authorId) throw new ForbiddenException('Không có quyền');

    return this.prisma.playlist.update({
      where: { id: playlistId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.visibility && { visibility: dto.visibility.toUpperCase() as any }),
      },
    });
  }

  async deletePlaylist(playlistId: string, authorId: string) {
    const playlist = await this.prisma.playlist.findUnique({ where: { id: playlistId } });
    if (!playlist) throw new NotFoundException('Playlist không tồn tại');
    if (playlist.authorId !== authorId) throw new ForbiddenException('Không có quyền');

    await this.prisma.playlist.delete({ where: { id: playlistId } });
    return null;
  }

  async addVideosToPlaylist(playlistId: string, authorId: string, dto: AddToPlaylistDto) {
    const playlist = await this.prisma.playlist.findUnique({ where: { id: playlistId } });
    if (!playlist) throw new NotFoundException('Playlist không tồn tại');
    if (playlist.authorId !== authorId) throw new ForbiddenException('Không có quyền');

    await this.prisma.$transaction(async (tx) => {
      let added = 0;
      for (const videoId of dto.videoIds) {
        const existing = await tx.playlistVideo.findUnique({
          where: { playlistId_videoId: { playlistId, videoId } },
        });
        if (!existing) {
          await tx.playlistVideo.create({
            data: { playlistId, videoId, orderIndex: playlist.itemCount + added },
          });
          added++;
        }
      }
      if (added > 0) {
        await tx.playlist.update({
          where: { id: playlistId },
          data: { itemCount: { increment: added } },
        });
      }
    });

    return { message: 'Đã thêm video vào playlist' };
  }

  async removeVideoFromPlaylist(playlistId: string, videoId: string, authorId: string) {
    const playlist = await this.prisma.playlist.findUnique({ where: { id: playlistId } });
    if (!playlist) throw new NotFoundException('Playlist không tồn tại');
    if (playlist.authorId !== authorId) throw new ForbiddenException('Không có quyền');

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.playlistVideo.findUnique({
        where: { playlistId_videoId: { playlistId, videoId } },
      });
      if (existing) {
        await tx.playlistVideo.delete({
          where: { playlistId_videoId: { playlistId, videoId } },
        });
        await tx.playlist.update({
          where: { id: playlistId },
          data: { itemCount: { decrement: 1 } },
        });
      }
    });

    return { message: 'Đã xóa video khỏi playlist' };
  }

  // ── 3. Watch History ──────────────────────────────────────

  async getHistory(userId: string, query: PaginationQueryDto) {
    const { page = 1, pageSize = 20 } = query;
    const [total, histories] = await Promise.all([
      this.prisma.watchHistory.count({ where: { userId } }),
      this.prisma.watchHistory.findMany({
        where: { userId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { lastWatchedAt: 'desc' },
        include: { video: { include: this.videoInclude } },
      }),
    ]);

    const allVideos = histories.filter(h => !h.video.isDeleted).map(h => h.video);
    const urlMap = await this.mediaResolver.resolveBatch(this.collectVideoMediaIds(allVideos));

    return {
      statusCode: 200,
      data: histories
        .filter(h => !h.video.isDeleted)
        .map(h => ({
          progressSeconds: h.progressSeconds,
          isFinished: h.isFinished,
          lastWatchedAt: h.lastWatchedAt,
          video: this.mapVideo(h.video, userId, urlMap),
        })),
      meta: { pagination: this.buildPagination(page, pageSize, total), timestamp: new Date().toISOString() },
    };
  }

  async updateHistory(userId: string, videoId: string, dto: UpdateHistoryDto) {
    await this.prisma.watchHistory.upsert({
      where: { userId_videoId: { userId, videoId } },
      create: {
        userId,
        videoId,
        progressSeconds: dto.progressSeconds,
        isFinished: dto.isFinished ?? false,
      },
      update: {
        progressSeconds: dto.progressSeconds,
        isFinished: dto.isFinished,
        lastWatchedAt: new Date(),
      },
    });

    return { message: 'Đã cập nhật lịch sử xem' };
  }

  async clearHistory(userId: string) {
    await this.prisma.watchHistory.deleteMany({ where: { userId } });
    return { message: 'Đã xóa toàn bộ lịch sử xem' };
  }

  // ── 4. Analytics ──────────────────────────────────────────

  async getVideoAnalytics(videoId: string, userId: string) {
    const video = await this.prisma.video.findUnique({ where: { id: videoId } });
    if (!video || video.isDeleted) throw new NotFoundException('Video không tồn tại');
    if (video.authorId !== userId) throw new ForbiddenException('Không có quyền xem analytics');

    // Mở rộng thêm tính watchTime từ WatchHistory sau này
    return {
      views: video.viewCount,
      likeCount: video.likeCount,
      commentCount: video.commentCount,
      shareCount: video.shareCount,
      engagementRate: video.viewCount > 0
        ? ((video.likeCount + video.commentCount + video.shareCount) / video.viewCount) * 100
        : 0,
    };
  }

  // ── Utils ─────────────────────────────────────────────────
  private extractHashtags(text: string): string[] {
    const matches = text.match(/#[\w\u00C0-\u024F]+/g) ?? [];
    return [...new Set(matches.map(h => h.slice(1).toLowerCase()))];
  }
}
