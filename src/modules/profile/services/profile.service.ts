import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PostType } from '@prisma/client-social';
import { createLogger } from '@daccuong-uit/platform-logger';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { UpdateProfileDto } from '../../users/dto/user.dto';

import { MediaResolverService } from '../../../common/services/media-resolver.service';

const logger = createLogger({ service: 'social-service:profile' });

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaResolver: MediaResolverService,
  ) { }

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

  private async canViewPost(post: any, currentUserId?: string, viewerId?: string) {
    if (!post || post.isDeleted) return false;

    if (post.authorId && currentUserId && post.authorId === currentUserId) {
      return true;
    }

    const visibility = (post.visibility ?? '').toString().toUpperCase();
    if (visibility === 'PUBLIC') {
      return true;
    }

    if (!viewerId || !post.authorId) {
      return false;
    }

    if (visibility === 'FRIENDS') {
      const friendship = await this.prisma.friendship.findFirst({
        where: {
          OR: [
            { initiatorId: post.authorId, receiverId: viewerId },
            { initiatorId: viewerId, receiverId: post.authorId },
          ],
          status: 'ACCEPTED',
        },
      });
      return !!friendship;
    }

    return false;
  }

  private mapProfileTabPost(post: any, currentUserId?: string, urlMap: Record<string, any> = {}) {
    const likes = Array.isArray(post.likes) ? post.likes : [];
    const bookmarks = Array.isArray(post.bookmarks) ? post.bookmarks : [];
    const derivedLikeCount = Array.isArray(likes) ? likes.length : Number(post.likeCount ?? 0);
    const isLikedByCurrentUser = currentUserId
      ? likes.some((like: any) => like.userId === currentUserId)
      : false;

    const authorAvatarUrls = post.author?.avatarMediaId ? urlMap[post.author.avatarMediaId]?.data : null;
    const mediaUrls: string[] = (post.mediaIds ?? [])
      .map((id: string) => urlMap[id]?.data?.original)
      .filter(Boolean);

    return {
      id: post.id,
      type: post.type?.toLowerCase?.() ?? 'text',
      content: post.content,
      mediaIds: post.mediaIds ?? [],
      mediaUrls,
      hashtags: post.hashtags ?? [],
      visibility: post.visibility?.toLowerCase?.() ?? 'public',
      likeCount: derivedLikeCount,
      commentCount: Number(post.commentCount ?? 0),
      shareCount: Number(post.shareCount ?? 0),
      viewCount: Number(post.viewCount ?? 0),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: post.author
        ? {
          id: post.author.userId,
          userId: post.author.userId,
          username: post.author.username,
          displayName: post.author.displayName,
          avatarMediaId: post.author.avatarMediaId,
          avatarUrl: authorAvatarUrls?.thumbnail || authorAvatarUrls?.original || null,
          bio: post.author.bio,
          isVerified: post.author.isVerified,
        }
        : null,
      isLikedByCurrentUser,
      isBookmarkedByCurrentUser: currentUserId
        ? bookmarks.some((bookmark: any) => bookmark.userId === currentUserId)
        : false,
      allowComments: true,
      isPinned: false,
      mentions: [],
    };
  }

  private mapProfile(u: any, urlMap: Record<string, any> = {}) {
    const avatarUrls = u.avatarMediaId ? urlMap[u.avatarMediaId]?.data : null;
    const coverUrls = u.coverMediaId ? urlMap[u.coverMediaId]?.data : null;
    return {
      id: u.userId,
      username: u.username,
      displayName: u.displayName,
      avatarMediaId: u.avatarMediaId,
      coverMediaId: u.coverMediaId,
      avatarUrl: avatarUrls?.thumbnail || avatarUrls?.original || null,
      coverUrl: coverUrls?.original || null,
      bio: u.bio,
      website: u.website,
      location: u.location,
      hometown: u.hometown,
      birthday: u.birthday,
      relationshipStatus: u.relationshipStatus,
      gender: u.gender,
      isVerified: u.isVerified,
      isPrivate: u.isPrivate,
      followerCount: u.followerCount,
      followingCount: u.followingCount,
      postCount: u.postCount,
      createdAt: u.createdAt,
    };
  }

  async getProfile(userId: string, currentUserId?: string) {
    logger.info('Getting user profile', { userId });

    const user = await this.prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    const [followerCount, followingCount, postCount] = await Promise.all([
      this.prisma.follow.count({
        where: { followingId: userId, status: 'ACCEPTED' },
      }),
      this.prisma.follow.count({
        where: { followerId: userId, status: 'ACCEPTED' },
      }),
      this.prisma.post.count({
        where: {
          authorId: userId,
          type: { notIn: [PostType.REPOST, PostType.QUOTE_REPOST] },
        },
      }),
    ]);

    user.followerCount = followerCount;
    user.followingCount = followingCount;
    user.postCount = postCount;

    const mediaIds = [user.avatarMediaId, user.coverMediaId].filter(Boolean) as string[];
    const urlMap = await this.mediaResolver.resolveBatch(mediaIds);
    const profile: any = this.mapProfile(user, urlMap);

    if (currentUserId && currentUserId !== userId) {
      const [follow, friendship, block, mute] = await Promise.all([
        this.prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: currentUserId,
              followingId: userId,
            },
          },
        }),
        this.prisma.friendship.findFirst({
          where: {
            OR: [
              { initiatorId: currentUserId, receiverId: userId },
              { initiatorId: userId, receiverId: currentUserId },
            ],
            status: 'ACCEPTED',
          },
        }),
        this.prisma.userBlock.findUnique({
          where: {
            blockerId_blockedId: {
              blockerId: currentUserId,
              blockedId: userId,
            },
          },
        }),
        this.prisma.userMute.findUnique({
          where: {
            muterId_mutedId: {
              muterId: currentUserId,
              mutedId: userId,
            },
          },
        }),
      ]);

      profile.isFollowedByCurrentUser = !!follow && follow.status === 'ACCEPTED';
      profile.isFollowPending = follow?.status === 'PENDING';
      profile.isFriend = !!friendship;
      profile.isBlocked = !!block;
      profile.isMuted = !!mute;
    }

    return profile;
  }


  async getProfileTabContent(userId: string, tabId: string, page: number, pageSize: number, currentUserId?: string) {
    logger.info('Getting profile tab content', { userId, tabId, page, pageSize });

    const skip = (page - 1) * pageSize;

    switch (tabId) {
      case 'posts': {
        const [total, posts] = await Promise.all([
          this.prisma.post.count({
            where: {
              authorId: userId,
              type: { notIn: [PostType.REPOST, PostType.QUOTE_REPOST] },
            },
          }),
          this.prisma.post.findMany({
            where: {
              authorId: userId,
              type: { notIn: [PostType.REPOST, PostType.QUOTE_REPOST] },
            },
            skip,
            take: pageSize,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              authorId: true,
              type: true,
              content: true,
              mediaIds: true,
              hashtags: true,
              visibility: true,
              likeCount: true,
              commentCount: true,
              shareCount: true,
              viewCount: true,
              createdAt: true,
              updatedAt: true,
              isDeleted: true,
              author: {
                select: {
                  userId: true,
                  username: true,
                  displayName: true,
                  avatarMediaId: true,
                  bio: true,
                  isVerified: true,
                },
              },
              likes: {
                select: { userId: true },
              },
              bookmarks: currentUserId
                ? {
                  where: { userId: currentUserId },
                  select: { userId: true },
                }
                : {
                  select: { userId: true },
                },
            },
          }),
        ]);

        const visiblePosts = [] as any[];
        for (const post of posts) {
          const canView = await this.canViewPost(post, currentUserId, currentUserId);
          if (canView) {
            visiblePosts.push(post);
          }
        }

        const postMediaIds = new Set<string>();
        for (const p of visiblePosts) {
          for (const id of (p.mediaIds ?? [])) postMediaIds.add(id);
          if (p.author?.avatarMediaId) postMediaIds.add(p.author.avatarMediaId);
        }
        const urlMap = await this.mediaResolver.resolveBatch([...postMediaIds]);

        return {
          statusCode: 200,
          data: visiblePosts.map((post) => this.mapProfileTabPost(post, currentUserId, urlMap)),
          meta: { pagination: this.buildPagination(page, pageSize, total), timestamp: new Date().toISOString() },
        };
      }

      case 'stories': {
        // Stories not yet implemented – return empty
        return {
          statusCode: 200,
          data: [],
          meta: { pagination: this.buildPagination(page, pageSize, 0), timestamp: new Date().toISOString() },
        };
      }

      case 'reels': {
        const [total, reels] = await Promise.all([
          this.prisma.reel.count({ where: { authorId: userId } }),
          this.prisma.reel.findMany({
            where: { authorId: userId },
            skip,
            take: pageSize,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              content: true,
              videoMediaId: true,
              thumbnailMediaId: true,
              duration: true,
              likeCount: true,
              commentCount: true,
              shareCount: true,
              viewCount: true,
              createdAt: true,
            },
          }),
        ]);

        return {
          statusCode: 200,
          data: reels,
          meta: { pagination: this.buildPagination(page, pageSize, total), timestamp: new Date().toISOString() },
        };
      }

      case 'videos': {
        const [total, videos] = await Promise.all([
          this.prisma.video.count({ where: { authorId: userId } }),
          this.prisma.video.findMany({
            where: { authorId: userId },
            skip,
            take: pageSize,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              title: true,
              description: true,
              thumbnailMediaId: true,
              duration: true,
              likeCount: true,
              commentCount: true,
              shareCount: true,
              viewCount: true,
              createdAt: true,
            },
          }),
        ]);

        return {
          statusCode: 200,
          data: videos,
          meta: { pagination: this.buildPagination(page, pageSize, total), timestamp: new Date().toISOString() },
        };
      }

      case 'novels': {
        const [total, novels] = await Promise.all([
          this.prisma.novel.count({ where: { authorId: userId } }),
          this.prisma.novel.findMany({
            where: { authorId: userId },
            skip,
            take: pageSize,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              title: true,
              synopsis: true,
              coverMediaId: true,
              genres: true,
              followerCount: true,
              viewCount: true,
              ratingCount: true,
              createdAt: true,
            },
          }),
        ]);

        return {
          statusCode: 200,
          data: novels,
          meta: { pagination: this.buildPagination(page, pageSize, total), timestamp: new Date().toISOString() },
        };
      }

      case 'friends': {
        // Return accepted friends (friendships where userId is involved)
        const [total, friendships] = await Promise.all([
          this.prisma.friendship.count({
            where: {
              OR: [
                { initiatorId: userId },
                { receiverId: userId },
              ],
              status: 'ACCEPTED',
            },
          }),
          this.prisma.friendship.findMany({
            where: {
              OR: [
                { initiatorId: userId },
                { receiverId: userId },
              ],
              status: 'ACCEPTED',
            },
            skip,
            take: pageSize,
            orderBy: { createdAt: 'desc' },
            select: {
              initiatorId: true,
              receiverId: true,
              createdAt: true,
            },
          }),
        ]);

        // Resolve the friend's profile for each friendship
        const friendIds = friendships.map((f) =>
          f.initiatorId === userId ? f.receiverId : f.initiatorId,
        );

        const friendProfiles = await this.prisma.userProfile.findMany({
          where: { userId: { in: friendIds } },
          select: {
            userId: true,
            username: true,
            displayName: true,
            avatarMediaId: true,
            isVerified: true,
          },
        });

        const followerCounts = await this.prisma.follow.groupBy({
          by: ['followingId'],
          where: { followingId: { in: friendIds }, status: 'ACCEPTED' },
          _count: { followingId: true },
        });

        const postCounts = await this.prisma.post.groupBy({
          by: ['authorId'],
          where: { authorId: { in: friendIds }, type: { notIn: ['REPOST', 'QUOTE_REPOST'] } },
          _count: { authorId: true },
        });

        const followerMap = new Map(followerCounts.map(fc => [fc.followingId, fc._count.followingId]));
        const postMap = new Map(postCounts.map(pc => [pc.authorId, pc._count.authorId]));

        const profileMap = new Map(friendProfiles.map((p) => [p.userId, p]));

        const data = friendIds.map((fid) => {
          const p = profileMap.get(fid);
          return {
            id: fid,
            username: p?.username ?? '',
            displayName: p?.displayName ?? p?.username ?? '',
            avatarMediaId: p?.avatarMediaId ?? null,
            isVerified: p?.isVerified ?? false,
            followerCount: followerMap.get(fid) ?? 0,
            postCount: postMap.get(fid) ?? 0,
          };
        });

        return {
          statusCode: 200,
          data,
          meta: { pagination: this.buildPagination(page, pageSize, total), timestamp: new Date().toISOString() },
        };
      }

      case 'groups': {
        // Return groups where the user is a member
        const [total, memberships] = await Promise.all([
          this.prisma.groupMember.count({
            where: { userId },
          }),
          this.prisma.groupMember.findMany({
            where: { userId },
            skip,
            take: pageSize,
            orderBy: { joinedAt: 'desc' },
            select: {
              group: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  coverMediaId: true,
                  privacy: true,
                  memberCount: true,
                  postCount: true,
                  createdAt: true,
                },
              },
            },
          }),
        ]);

        return {
          statusCode: 200,
          data: memberships.map((m) => m.group),
          meta: { pagination: this.buildPagination(page, pageSize, total), timestamp: new Date().toISOString() },
        };
      }

      default:
        throw new BadRequestException('Tab profile không hợp lệ');
    }
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    logger.info('Updating user profile', { userId });

    const user = await this.prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    const updated = await this.prisma.userProfile.update({
      where: { userId },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.avatarMediaId !== undefined && { avatarMediaId: dto.avatarMediaId }),
        ...(dto.coverMediaId !== undefined && { coverMediaId: dto.coverMediaId }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.hometown !== undefined && { hometown: dto.hometown }),
        ...(dto.birthday !== undefined && { birthday: dto.birthday ? new Date(dto.birthday) : null }),
        ...(dto.relationshipStatus !== undefined && { relationshipStatus: dto.relationshipStatus }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.isPrivate !== undefined && { isPrivate: dto.isPrivate }),
      },
    });

    return this.mapProfile(updated);
  }


}
