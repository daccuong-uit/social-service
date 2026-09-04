import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createLogger } from '@platform/logger';
import { EventBusService, DomainEvent } from '@platform/common';
import { PostVisibility } from '@prisma/client-social';
import { randomUUID } from 'crypto';
import {
  CreatePostDto,
  UpdatePostDto,
  SharePostDto,
  PostsQueryDto,
  FeedQueryDto,
  DiscoverQueryDto,
} from './dto/post.dto';
import { PostLikeCacheService } from './post-like-cache.service';
import { MediaResolverService } from '../common/services/media-resolver.service';

const logger = createLogger({ service: 'social-service:posts' });

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly postLikeCache: PostLikeCacheService,
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

  private isVisibleToUser(post: any, currentUserId?: string, viewerId?: string) {
    if (!post || post.isDeleted) return false;

    const authorId = post.authorId ?? post.author?.userId;
    const visibility = (post.visibility ?? '').toString().toUpperCase();

    if (authorId && currentUserId && authorId === currentUserId) {
      return true;
    }

    if (visibility === PostVisibility.PUBLIC.toUpperCase()) {
      return true;
    }

    if (visibility === PostVisibility.FRIENDS.toUpperCase()) {
      if (!viewerId || !authorId) return false;

      return this.isFriend(authorId, viewerId);
    }

    return false;
  }

  private async isFriend(authorId: string, viewerId: string) {
    if (authorId === viewerId) return true;

    const friendship = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { initiatorId: authorId, receiverId: viewerId },
          { initiatorId: viewerId, receiverId: authorId },
        ],
        status: 'ACCEPTED',
      },
    });

    return !!friendship;
  }

  private async filterVisiblePosts(posts: any[], currentUserId?: string, viewerId?: string) {
    const results = await Promise.all(
      posts.map(async (post) => {
        const visible = await this.isVisibleToUser(post, currentUserId, viewerId);
        return visible ? post : null;
      }),
    );

    return results.filter(Boolean);
  }

  private mapPost(post: any, currentUserId?: string, urlMap: Record<string, any> = {}) {
    const likes = post.likes ?? [];
    const isLiked = currentUserId
      ? likes.some((like: any) => like.userId === currentUserId)
      : false;

    const isBookmarked = currentUserId
      ? (post.bookmarks ?? []).some((b: any) => b.userId === currentUserId)
      : false;

    const likeCount = Array.isArray(likes) ? likes.length : Number(post.likeCount ?? 0);

    // Resolve media URLs for post media items
    const mediaUrls: string[] = (post.mediaIds ?? [])
      .map((id: string) => urlMap[id]?.data?.original)
      .filter(Boolean);

    const mapped = {
      id: post.id,
      author: post.author ? this.mapAuthor(post.author, urlMap) : null,
      type: post.type.toLowerCase(),
      content: post.content,
      mediaIds: post.mediaIds,
      mediaUrls,
      hashtags: post.hashtags,
      poll: post.poll
        ? {
          id: post.poll.id,
          question: post.poll.question,
          options: post.poll.options.map((o: any) => ({
            id: o.id,
            text: o.text,
            voteCount: o.voteCount,
          })),
          totalVotes: post.poll.totalVotes,
          endsAt: post.poll.endsAt,
        }
        : null,
      groupId: post.groupId,
      likeCount,
      commentCount: post.commentCount,
      shareCount: post.shareCount,
      isLikedByCurrentUser: isLiked,
      isBookmarkedByCurrentUser: isBookmarked,
      isRepostedByCurrentUser: false,
      visibility: post.visibility.toLowerCase(),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };

    if (post.originalPost && !post.originalPost.isDeleted) {
      (mapped as any).originalPost = this.mapPost(post.originalPost, currentUserId, urlMap);
    }

    return mapped;
  }

  /** Collect unique mediaIds from posts (post media + author avatars) */
  private collectPostMediaIds(posts: any[]): string[] {
    const ids = new Set<string>();
    for (const p of posts) {
      for (const id of (p.mediaIds ?? [])) ids.add(id);
      if (p.author?.avatarMediaId) ids.add(p.author.avatarMediaId);
      if (p.originalPost) {
        for (const id of (p.originalPost.mediaIds ?? [])) ids.add(id);
        if (p.originalPost.author?.avatarMediaId) ids.add(p.originalPost.author.avatarMediaId);
      }
    }
    return [...ids];
  }

  private async syncLikeCount(postId: string, tx?: any): Promise<number> {
    const likeCount = await (tx ?? this.prisma).postLike.count({ where: { postId } });
    await (tx ?? this.prisma).post.update({
      where: { id: postId },
      data: { likeCount },
    });
    await this.postLikeCache.set(postId, likeCount);
    return likeCount;
  }

  private async hydrateLikeCounts(posts: any[]): Promise<void> {
    await Promise.all(
      posts.map(async (post) => {
        const cachedCount = await this.postLikeCache.get(post.id);
        const derivedCount = Array.isArray(post.likes)
          ? post.likes.length
          : Number(post.likeCount ?? 0);

        if (cachedCount !== null) {
          post.likeCount = cachedCount;
        } else {
          await this.postLikeCache.set(post.id, derivedCount);
          post.likeCount = derivedCount;
        }
      }),
    );
  }

  private readonly postInclude = {
    author: true,
    poll: { include: { options: true } },
    likes: { select: { userId: true } },
    bookmarks: { select: { userId: true } },
    originalPost: {
      include: {
        author: true,
        poll: { include: { options: true } },
        likes: { select: { userId: true } },
        bookmarks: { select: { userId: true } },
      },
    },
  };

  // ── Personal Feed ─────────────────────────────────────────
  async getPersonalFeed(userId: string, page: number, pageSize: number) {
    logger.info('Getting personal feed', { userId, page, pageSize });

    const [acceptedFollows, acceptedFriendships] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followerId: userId, status: 'ACCEPTED' },
        select: { followingId: true },
      }),
      this.prisma.friendship.findMany({
        where: {
          OR: [{ initiatorId: userId }, { receiverId: userId }],
          status: 'ACCEPTED',
        },
        select: { initiatorId: true, receiverId: true },
      }),
    ]);

    const followingIds = acceptedFollows.map((f) => f.followingId);
    const friendIds = acceptedFriendships
      .map((f) => (f.initiatorId === userId ? f.receiverId : f.initiatorId))
      .filter(Boolean);

    const authorIds = [userId, ...followingIds, ...friendIds];

    const visiblePostsWhere = {
      isDeleted: false,
      OR: [
        { authorId: userId },
        { visibility: PostVisibility.PUBLIC },
        {
          AND: [
            { visibility: PostVisibility.FRIENDS },
            { authorId: { in: friendIds } },
          ],
        },
      ],
      authorId: { in: authorIds },
    };

    const [total, posts] = await Promise.all([
      this.prisma.post.count({ where: visiblePostsWhere }),
      this.prisma.post.findMany({
        where: visiblePostsWhere,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: this.postInclude,
      }),
    ]);

    const visiblePosts = await this.filterVisiblePosts(posts, userId, userId);
    await this.hydrateLikeCounts(visiblePosts);
    const urlMap = await this.mediaResolver.resolveBatch(this.collectPostMediaIds(visiblePosts));
    return {
      statusCode: 200,
      data: visiblePosts.map((p) => this.mapPost(p, userId, urlMap)),
      meta: { pagination: this.buildPagination(page, pageSize, total), timestamp: new Date().toISOString() },
    };
  }

  // ── Discover Feed ─────────────────────────────────────────
  async getDiscoverFeed(query: DiscoverQueryDto, currentUserId?: string) {
    const { page = 1, pageSize = 20, filter = 'latest' } = query;
    logger.info('Getting discover feed', { filter, page, pageSize });

    const orderBy =
      filter === 'trending'
        ? [{ likeCount: 'desc' as const }, { createdAt: 'desc' as const }]
        : { createdAt: 'desc' as const };

    const [total, posts] = await Promise.all([
      this.prisma.post.count({
        where: { isDeleted: false, visibility: PostVisibility.PUBLIC },
      }),
      this.prisma.post.findMany({
        where: { isDeleted: false, visibility: PostVisibility.PUBLIC },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: Array.isArray(orderBy) ? orderBy : [orderBy],
        include: this.postInclude,
      }),
    ]);

    await this.hydrateLikeCounts(posts);
    const urlMap = await this.mediaResolver.resolveBatch(this.collectPostMediaIds(posts));

    return {
      statusCode: 200,
      data: posts.map((p) => this.mapPost(p, currentUserId, urlMap)),
      meta: { pagination: this.buildPagination(page, pageSize, total), timestamp: new Date().toISOString() },
    };
  }

  // ── List Posts (filtered) ─────────────────────────────────
  async listPosts(query: PostsQueryDto, currentUserId?: string) {
    const { page = 1, pageSize = 20, authorId, hashtag, type, groupId } = query;
    logger.info('Listing posts', { query });

    const where: any = { isDeleted: false, visibility: PostVisibility.PUBLIC };
    if (authorId) where.authorId = authorId;
    if (hashtag) where.hashtags = { has: hashtag };
    if (type) where.type = type.toUpperCase();
    if (groupId) where.groupId = groupId;

    const [total, posts] = await Promise.all([
      this.prisma.post.count({ where }),
      this.prisma.post.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: this.postInclude,
      }),
    ]);

    await this.hydrateLikeCounts(posts);
    const urlMap = await this.mediaResolver.resolveBatch(this.collectPostMediaIds(posts));

    return {
      data: posts.map((p) => this.mapPost(p, currentUserId, urlMap)),
      meta: { pagination: this.buildPagination(page, pageSize, total) },
    };
  }

  // ── Create Post ───────────────────────────────────────────
  async createPost(authorId: string, dto: CreatePostDto) {
    logger.info('Creating post', { authorId, type: dto.type });

    if (dto.originalPostId) {
      const originalPost = await this.prisma.post.findUnique({ where: { id: dto.originalPostId } });
      if (!originalPost || originalPost.isDeleted) {
        throw new NotFoundException('Bài gốc không tồn tại');
      }
      dto.type = 'repost' as any;
    }

    const post = await this.prisma.$transaction(async (tx) => {
      const newPost = await tx.post.create({
        data: {
          authorId,
          type: (dto.type ?? 'text').toUpperCase() as any,
          content: dto.content,
          mediaIds: dto.mediaIds ?? [],
          hashtags: [...new Set([...this.extractHashtags(dto.content), ...(dto.hashtags || [])])],
          visibility: (dto.visibility ?? 'public').toUpperCase() as any,
          groupId: dto.groupId ?? null,
          linkUrl: dto.linkUrl ?? null,
          originalPostId: dto.originalPostId ?? null,
        },
        include: this.postInclude,
      });

      if (dto.originalPostId) {
        await tx.post.update({
          where: { id: dto.originalPostId },
          data: { shareCount: { increment: 1 } },
        });
      }

      // Create poll if provided
      if (dto.poll) {
        await tx.poll.create({
          data: {
            postId: newPost.id,
            question: dto.poll.question,
            endsAt: dto.poll.endsAt ? new Date(dto.poll.endsAt) : null,
            options: {
              createMany: {
                data: dto.poll.options.map((text) => ({ text })),
              },
            },
          },
        });
      }

      // Increment user post count
      await tx.userProfile.update({
        where: { userId: authorId },
        data: { postCount: { increment: 1 } },
      });

      return newPost;
    });

    // Reload with full includes
    const fullPost = await this.prisma.post.findUnique({
      where: { id: post.id },
      include: this.postInclude,
    });

    const urlMap = await this.mediaResolver.resolveBatch(this.collectPostMediaIds([fullPost!]));
    return this.mapPost(fullPost!, authorId, urlMap);
  }

  // ── Get Post By ID ────────────────────────────────────────
  async getById(postId: string, currentUserId?: string) {
    logger.info('Getting post by id', { postId });

    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: this.postInclude,
    });

    if (!post || post.isDeleted) {
      throw new NotFoundException('Bài đăng không tồn tại');
    }

    const isVisible = await this.isVisibleToUser(post, currentUserId, currentUserId);
    if (!isVisible) {
      throw new ForbiddenException('Bạn không có quyền xem bài đăng này');
    }

    await this.hydrateLikeCounts([post]);
    const urlMap = await this.mediaResolver.resolveBatch(this.collectPostMediaIds([post]));
    return this.mapPost(post, currentUserId, urlMap);
  }

  // ── Update Post ───────────────────────────────────────────
  async updatePost(postId: string, authorId: string, dto: UpdatePostDto) {
    logger.info('Updating post', { postId, authorId });

    const post = await this.prisma.post.findUnique({ where: { id: postId } });

    if (!post || post.isDeleted) {
      throw new NotFoundException('Bài đăng không tồn tại');
    }
    if (post.authorId !== authorId) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa bài đăng này');
    }

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: {
        ...(dto.content !== undefined && {
          content: dto.content,
          hashtags: this.extractHashtags(dto.content),
        }),
        ...(dto.visibility !== undefined && {
          visibility: dto.visibility.toUpperCase() as any,
        }),
      },
      include: this.postInclude,
    });

    const urlMap = await this.mediaResolver.resolveBatch(this.collectPostMediaIds([updated]));
    return this.mapPost(updated, authorId, urlMap);
  }

  // ── Delete Post ───────────────────────────────────────────
  async deletePost(postId: string, authorId: string) {
    logger.info('Deleting post', { postId, authorId });

    const post = await this.prisma.post.findUnique({ where: { id: postId } });

    if (!post || post.isDeleted) {
      throw new NotFoundException('Bài đăng không tồn tại');
    }
    if (post.authorId !== authorId) {
      throw new ForbiddenException('Bạn không có quyền xóa bài đăng này');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.post.update({ where: { id: postId }, data: { isDeleted: true } });
      await tx.userProfile.update({
        where: { userId: authorId },
        data: { postCount: { decrement: 1 } },
      });
      if (post.originalPostId) {
        await tx.post.update({
          where: { id: post.originalPostId },
          data: { shareCount: { decrement: 1 } },
        });
      }
    });

    return null;
  }

  // ── Like / Unlike ─────────────────────────────────────────
  async likePost(postId: string, userId: string) {
    logger.info('Liking post', { postId, userId });

    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.isDeleted) {
      throw new NotFoundException('Bài đăng không tồn tại');
    }

    const existingLike = await this.prisma.postLike.findUnique({
      where: {
        userId_postId: { userId, postId },
      },
    });

    if (!existingLike) {
      await this.prisma.$transaction(async (tx) => {
        await tx.postLike.create({
          data: { userId, postId },
        });
        await this.syncLikeCount(postId, tx);
      });

      try {
        const event: DomainEvent = {
          event_id: randomUUID(),
          event_name: 'post.like.created.v1',
          occurred_at: new Date().toISOString(),
          producer: 'social-service',
          payload: { postId, userId },
        };
        await this.eventBus.publish(event);
      } catch (error) {
        logger.error('Failed to publish post.like.created.v1 event', error);
      }
    }

    const updated = await this.prisma.post.findUnique({ where: { id: postId } });
    return {
      likeCount: updated?.likeCount ?? 0,
      isLikedByCurrentUser: true,
    };
  }

  async unlikePost(postId: string, userId: string) {
    logger.info('Unliking post', { postId, userId });

    const existingLike = await this.prisma.postLike.findUnique({
      where: {
        userId_postId: { userId, postId },
      },
    });

    if (existingLike) {
      await this.prisma.$transaction(async (tx) => {
        await tx.postLike.delete({
          where: {
            userId_postId: { userId, postId },
          },
        });
        await this.syncLikeCount(postId, tx);
      });

      try {
        const event: DomainEvent = {
          event_id: randomUUID(),
          event_name: 'post.like.deleted.v1',
          occurred_at: new Date().toISOString(),
          producer: 'social-service',
          payload: { postId, userId },
        };
        await this.eventBus.publish(event);
      } catch (error) {
        logger.error('Failed to publish post.like.deleted.v1 event', error);
      }
    }

    const updated = await this.prisma.post.findUnique({ where: { id: postId } });
    return {
      likeCount: updated?.likeCount ?? 0,
      isLikedByCurrentUser: false,
    };
  }

  // ── Hide Post ─────────────────────────────────────────────
  async hidePost(postId: string, userId: string) {
    logger.info('Hiding post', { postId, userId });

    await this.prisma.postHidden.upsert({
      where: { postId_userId: { postId, userId } },
      create: { postId, userId },
      update: {},
    });

    return { message: 'Đã ẩn bài đăng khỏi feed' };
  }

  // ── Report Post ───────────────────────────────────────────
  async reportPost(postId: string, userId: string, reason: string, description?: string) {
    logger.info('Reporting post', { postId, userId, reason });
    // TODO: persist to moderation queue
    return { message: 'Đã gửi báo cáo thành công' };
  }

  // ── Share Post ────────────────────────────────────────────
  async sharePost(postId: string, userId: string, dto: SharePostDto) {
    logger.info('Sharing post', { postId, userId, dto });

    await this.prisma.post.update({
      where: { id: postId },
      data: { shareCount: { increment: 1 } },
    });

    return { message: 'Đã chia sẻ bài đăng' };
  }

  // ── Analytics ─────────────────────────────────────────────
  async getPostAnalytics(postId: string, userId: string) {
    logger.info('Getting post analytics', { postId, userId });

    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.isDeleted) {
      throw new NotFoundException('Bài đăng không tồn tại');
    }
    if (post.authorId !== userId) {
      throw new ForbiddenException('Bạn không có quyền xem analytics của bài đăng này');
    }

    return {
      views: post.viewCount,
      impressions: post.viewCount,
      reaches: Math.floor(post.viewCount * 0.8),
      engagementRate:
        post.viewCount > 0
          ? ((post.likeCount + post.commentCount + post.shareCount) / post.viewCount) * 100
          : 0,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      shareCount: post.shareCount,
      repostCount: post.repostCount,
    };
  }

  // ── Util: extract hashtags from content ───────────────────
  private extractHashtags(content: string): string[] {
    const matches = content.match(/#[\w\u00C0-\u024F]+/g) ?? [];
    return [...new Set(matches.map((h) => h.slice(1).toLowerCase()))];
  }
}
