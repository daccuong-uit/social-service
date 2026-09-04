import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createLogger } from '@platform/logger';
import { getMenuItemsForContext } from '../common/utils/menu-config';

const logger = createLogger({ service: 'social-service:friendship' });

@Injectable()
export class FriendshipService {
  constructor(private readonly prisma: PrismaService) { }

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

  private async createAutoFollowIfNeeded(
    tx: any,
    followerId: string,
    followingId: string,
  ) {
    const existingFollow = await tx.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });

    if (existingFollow) {
      return;
    }

    await tx.follow.create({
      data: { followerId, followingId, status: 'ACCEPTED' },
    });

    await tx.userProfile.update({
      where: { userId: followingId },
      data: { followerCount: { increment: 1 } },
    });
    await tx.userProfile.update({
      where: { userId: followerId },
      data: { followingCount: { increment: 1 } },
    });
  }

  private async removeAutoFollowIfNeeded(
    tx: any,
    followerId: string,
    followingId: string,
    friendshipCreatedAt: Date,
  ) {
    const follow = await tx.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });

    if (follow && follow.createdAt >= friendshipCreatedAt) {
      await tx.follow.delete({
        where: { followerId_followingId: { followerId, followingId } },
      });

      await tx.userProfile.update({
        where: { userId: followingId },
        data: { followerCount: { decrement: 1 } },
      });
      await tx.userProfile.update({
        where: { userId: followerId },
        data: { followingCount: { decrement: 1 } },
      });
    }
  }

  private mapUser(u: any, overrides: Record<string, any> = {}) {
    const { mutualFriends = 0, relationshipDate = null, status = 'accepted', relationshipType = 'friend', ...rest } = overrides;
    return {
      id: u.userId ?? u.id,
      name: u.displayName ?? u.username ?? u.name ?? 'Unknown',
      username: u.username ?? undefined,
      avatar: u.avatarMediaId ?? u.avatar ?? null,
      mutualFriends,
      relationshipDate,
      status,
      relationshipType,
      bio: u.bio ?? null,
      website: u.website ?? null,
      location: u.location ?? null,
      hometown: u.hometown ?? null,
      birthday: u.birthday ?? null,
      gender: u.gender ?? null,
      relationshipStatus: u.relationshipStatus ?? null,
      ...rest,
    };
  }

  private async getMutualFriendCount(currentUserId: string, targetId: string) {
    const [userFriendships, targetFriendships] = await Promise.all([
      this.prisma.friendship.findMany({
        where: {
          OR: [{ initiatorId: currentUserId }, { receiverId: currentUserId }],
          status: 'ACCEPTED',
        },
        select: { initiatorId: true, receiverId: true },
      }),
      this.prisma.friendship.findMany({
        where: {
          OR: [{ initiatorId: targetId }, { receiverId: targetId }],
          status: 'ACCEPTED',
        },
        select: { initiatorId: true, receiverId: true },
      }),
    ]);

    const userFriendIds = new Set(
      userFriendships.flatMap((entry) => [entry.initiatorId, entry.receiverId]).filter((id) => id !== currentUserId),
    );
    const targetFriendIds = new Set(
      targetFriendships.flatMap((entry) => [entry.initiatorId, entry.receiverId]).filter((id) => id !== targetId),
    );

    let mutualFriends = 0;
    targetFriendIds.forEach((id) => {
      if (userFriendIds.has(id)) {
        mutualFriends += 1;
      }
    });

    return mutualFriends;
  }

  /** Batch-fetch which of the given targetIds are muted/blocked by userId. */
  private async getMuteBlockSets(userId: string, targetIds: string[]) {
    if (targetIds.length === 0) return { muteSet: new Set<string>(), blockSet: new Set<string>() };
    const [mutes, blocks] = await Promise.all([
      this.prisma.userMute.findMany({
        where: { muterId: userId, mutedId: { in: targetIds } },
        select: { mutedId: true },
      }),
      this.prisma.userBlock.findMany({
        where: { blockerId: userId, blockedId: { in: targetIds } },
        select: { blockedId: true },
      }),
    ]);
    return {
      muteSet: new Set(mutes.map(m => m.mutedId)),
      blockSet: new Set(blocks.map(b => b.blockedId)),
    };
  }

  // ── Friend List ──────────────────────────────────────────
  async getFriends(userId: string, page: number, pageSize: number) {
    logger.info('Getting friends list', { userId, page, pageSize });

    const [total, friendships] = await Promise.all([
      this.prisma.friendship.count({
        where: {
          OR: [{ initiatorId: userId }, { receiverId: userId }],
          status: 'ACCEPTED',
        },
      }),
      this.prisma.friendship.findMany({
        where: {
          OR: [{ initiatorId: userId }, { receiverId: userId }],
          status: 'ACCEPTED',
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { initiator: true, receiver: true },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const friendIds = friendships.map(f => f.initiatorId === userId ? f.receiverId : f.initiatorId);
    const [follows, { muteSet, blockSet }, followerCounts, postCounts, privatePostCounts] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followerId: userId, followingId: { in: friendIds }, status: 'ACCEPTED' },
        select: { followingId: true },
      }),
      this.getMuteBlockSets(userId, friendIds),
      this.prisma.follow.groupBy({
        by: ['followingId'],
        where: { followingId: { in: friendIds }, status: 'ACCEPTED' },
        _count: { followingId: true },
      }),
      this.prisma.post.groupBy({
        by: ['authorId'],
        where: { authorId: { in: friendIds }, type: { notIn: ['REPOST', 'QUOTE_REPOST'] } },
        _count: { authorId: true },
      }),
      this.prisma.post.groupBy({
        by: ['authorId'],
        where: { authorId: { in: friendIds }, visibility: 'PRIVATE', type: { notIn: ['REPOST', 'QUOTE_REPOST'] } },
        _count: { authorId: true },
      }),
    ]);
    const followingSet = new Set(follows.map(f => f.followingId));
    const followerMap = new Map(followerCounts.map(fc => [fc.followingId, fc._count.followingId]));
    const postMap = new Map(postCounts.map(pc => [pc.authorId, pc._count.authorId]));
    const privatePostMap = new Map(privatePostCounts.map(pc => [pc.authorId, pc._count.authorId]));

    const friends = await Promise.all(
      friendships.map(async (f) => {
        const friend = f.initiatorId === userId ? f.receiver : f.initiator;
        return this.mapUser(friend, {
          status: 'friend',
          relationshipDate: f.updatedAt,
          relationshipType: f.type,
          followerCount: followerMap.get(friend.userId) ?? 0,
          postCount: postMap.get(friend.userId) ?? 0,
          privatePostCount: privatePostMap.get(friend.userId) ?? 0,
          mutualFriends: await this.getMutualFriendCount(userId, friend.userId),
          menuItems: getMenuItemsForContext('all', {
            isFriend: true,
            isFollowing: followingSet.has(friend.userId),
            isMuted: muteSet.has(friend.userId),
            isBlocked: blockSet.has(friend.userId),
          }),
        });
      }),
    );

    return {
      statusCode: 200,
      data: friends,
      meta: { pagination: this.buildPagination(page, pageSize, total), timestamp: new Date().toISOString() },
    };
  }

  // ── Suggestions ──────────────────────────────────────────
  async getSuggestions(userId: string, page: number, pageSize: number) {
    logger.info('Getting friend suggestions', { userId, page, pageSize });

    // Get current friend IDs
    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [{ initiatorId: userId }, { receiverId: userId }],
        status: 'ACCEPTED',
      },
      select: { initiatorId: true, receiverId: true },
    });

    const friendIds = friendships.flatMap((f) =>
      [f.initiatorId, f.receiverId].filter((id) => id !== userId),
    );

    const pendingFriendships = await this.prisma.friendship.findMany({
      where: {
        OR: [{ initiatorId: userId }, { receiverId: userId }],
        status: 'PENDING',
      },
      select: { initiatorId: true, receiverId: true },
    });

    const pendingTargetIds = new Set(
      pendingFriendships
        .flatMap((f) => [f.initiatorId, f.receiverId])
        .filter((id) => id !== userId),
    );

    const excludedUserIds = [...friendIds, ...pendingTargetIds];

    const [total, suggestions] = await Promise.all([
      this.prisma.userProfile.count({
        where: {
          userId: { notIn: [userId, ...excludedUserIds] },
        },
      }),
      this.prisma.userProfile.findMany({
        where: {
          userId: { notIn: [userId, ...excludedUserIds] },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { followerCount: 'desc' },
      }),
    ]);

    const data = await Promise.all(
      suggestions.map(async (u) =>
        this.mapUser(u, {
          status: 'suggested',
          mutualFriends: await this.getMutualFriendCount(userId, u.userId),
        }),
      ),
    );

    return {
      statusCode: 200,
      data: Array.isArray(data) ? data : [],
      meta: { pagination: this.buildPagination(page, pageSize, total), timestamp: new Date().toISOString() },
    };
  }

  // ── Incoming Requests ────────────────────────────────────
  async getIncomingRequests(userId: string, page: number, pageSize: number) {
    logger.info('Getting incoming friend requests', { userId, page, pageSize });

    const [total, requests] = await Promise.all([
      this.prisma.friendship.count({
        where: { receiverId: userId, status: 'PENDING' },
      }),
      this.prisma.friendship.findMany({
        where: { receiverId: userId, status: 'PENDING' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { initiator: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const data = await Promise.all(
      requests.map(async (r) =>
        this.mapUser(r.initiator, {
          status: 'pending',
          relationshipDate: r.createdAt,
          mutualFriends: await this.getMutualFriendCount(userId, r.initiator.userId),
        }),
      ),
    );

    return {
      statusCode: 200,
      data: Array.isArray(data) ? data : [],
      meta: { pagination: this.buildPagination(page, pageSize, total), timestamp: new Date().toISOString() },
    };
  }

  // ── Sent Requests ────────────────────────────────────────
  async getSentRequests(userId: string, page: number, pageSize: number) {
    logger.info('Getting sent friend requests', { userId, page, pageSize });

    const [total, requests] = await Promise.all([
      this.prisma.friendship.count({
        where: { initiatorId: userId, status: 'PENDING' },
      }),
      this.prisma.friendship.findMany({
        where: { initiatorId: userId, status: 'PENDING' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { receiver: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const data = await Promise.all(
      requests.map(async (r) =>
        this.mapUser(r.receiver, {
          status: 'pending',
          relationshipDate: r.createdAt,
          mutualFriends: await this.getMutualFriendCount(userId, r.receiver.userId),
        }),
      ),
    );

    return {
      statusCode: 200,
      data: Array.isArray(data) ? data : [],
      meta: { pagination: this.buildPagination(page, pageSize, total), timestamp: new Date().toISOString() },
    };
  }

  // ── Send Request ─────────────────────────────────────────
  async sendRequest(initiatorId: string, receiverId: string) {
    logger.info('Sending friend request', { initiatorId, receiverId });

    if (initiatorId === receiverId) {
      throw new ConflictException('Không thể tự kết bạn với chính mình');
    }

    // Check if blocked
    const blocked = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: initiatorId, blockedId: receiverId },
          { blockerId: receiverId, blockedId: initiatorId },
        ],
      },
    });
    if (blocked) {
      throw new ForbiddenException('Không thể gửi lời mời kết bạn');
    }

    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { initiatorId, receiverId },
          { initiatorId: receiverId, receiverId: initiatorId },
        ],
      },
    });

    if (existing?.status === 'ACCEPTED') {
      throw new ConflictException('Hai người đã là bạn bè');
    }
    if (existing?.status === 'PENDING') {
      throw new ConflictException('Lời mời kết bạn đã được gửi');
    }

    await this.prisma.$transaction(async (tx) => {
      const friendship = await tx.friendship.create({
        data: { initiatorId, receiverId, status: 'PENDING' },
      });

      await this.createAutoFollowIfNeeded(tx, initiatorId, receiverId);

      await this.removeAutoFollowIfNeeded(tx, receiverId, initiatorId, friendship.createdAt);
    });

    return { statusCode: 200, message: 'Đã gửi lời mời kết bạn', timestamp: new Date().toISOString() };
  }

  // ── Cancel Sent Request ──────────────────────────────────
  async cancelRequest(initiatorId: string, receiverId: string) {
    logger.info('Cancelling friend request', { initiatorId, receiverId });

    const existing = await this.prisma.friendship.findFirst({
      where: { initiatorId, receiverId, status: 'PENDING' },
    });

    if (!existing) {
      return { statusCode: 200, message: 'Đã hủy lời mời kết bạn', timestamp: new Date().toISOString() };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.friendship.deleteMany({
        where: { initiatorId, receiverId, status: 'PENDING' },
      });

      await this.removeAutoFollowIfNeeded(tx, initiatorId, receiverId, existing.createdAt);
    });

    return { statusCode: 200, message: 'Đã hủy lời mời kết bạn', timestamp: new Date().toISOString() };
  }

  // ── Accept Request ───────────────────────────────────────
  async acceptRequest(receiverId: string, initiatorId: string) {
    logger.info('Accepting friend request', { receiverId, initiatorId });

    const friendship = await this.prisma.friendship.findFirst({
      where: { initiatorId, receiverId, status: 'PENDING' },
    });

    if (!friendship) {
      throw new NotFoundException('Không tìm thấy lời mời kết bạn');
    }

    await this.prisma.friendship.update({
      where: { id: friendship.id },
      data: { status: 'ACCEPTED' },
    });

    return { statusCode: 200, message: 'Đã chấp nhận lời mời kết bạn', timestamp: new Date().toISOString() };
  }

  // ── Reject Request ───────────────────────────────────────
  async rejectRequest(receiverId: string, initiatorId: string) {
    logger.info('Rejecting friend request', { receiverId, initiatorId });

    const existing = await this.prisma.friendship.findFirst({
      where: { initiatorId, receiverId, status: 'PENDING' },
    });

    if (!existing) {
      return { statusCode: 200, message: 'Đã từ chối lời mời kết bạn', timestamp: new Date().toISOString() };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.friendship.deleteMany({
        where: { initiatorId, receiverId, status: 'PENDING' },
      });

      await this.removeAutoFollowIfNeeded(tx, initiatorId, receiverId, existing.createdAt);
    });

    return { statusCode: 200, message: 'Đã từ chối lời mời kết bạn', timestamp: new Date().toISOString() };
  }

  // ── Unfriend ─────────────────────────────────────────────
  async unfriend(userId: string, friendId: string) {
    logger.info('Unfriending', { userId, friendId });

    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { initiatorId: userId, receiverId: friendId },
          { initiatorId: friendId, receiverId: userId },
        ],
        status: 'ACCEPTED',
      },
    });

    if (!existing) {
      return { statusCode: 200, message: 'Đã hủy kết bạn', timestamp: new Date().toISOString() };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.friendship.deleteMany({
        where: {
          OR: [
            { initiatorId: userId, receiverId: friendId },
            { initiatorId: friendId, receiverId: userId },
          ],
          status: 'ACCEPTED',
        },
      });

      await this.removeAutoFollowIfNeeded(tx, userId, friendId, existing.createdAt);
      await this.removeAutoFollowIfNeeded(tx, friendId, userId, existing.createdAt);
    });

    return { statusCode: 200, message: 'Đã hủy kết bạn', timestamp: new Date().toISOString() };
  }

  // ── Update Relationship Type ─────────────────────────────
  async updateRelationshipType(userId: string, friendId: string, type: any) {
    logger.info('Updating relationship type', { userId, friendId, type });

    const friendship = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { initiatorId: userId, receiverId: friendId },
          { initiatorId: friendId, receiverId: userId },
        ],
        status: 'ACCEPTED',
      },
    });

    if (!friendship) {
      throw new NotFoundException('Không tìm thấy mối quan hệ bạn bè');
    }

    await this.prisma.friendship.update({
      where: { id: friendship.id },
      data: { type },
    });

    return { statusCode: 200, message: 'Đã cập nhật mối quan hệ', timestamp: new Date().toISOString() };
  }

  async getRelationships(userId: string, page: number, pageSize: number) {
    logger.info('Getting relationships', { userId, page, pageSize });

    const [total, friendships] = await Promise.all([
      this.prisma.friendship.count({
        where: {
          OR: [{ initiatorId: userId }, { receiverId: userId }],
          status: 'ACCEPTED',
          type: { not: 'NORMAL' },
        },
      }),
      this.prisma.friendship.findMany({
        where: {
          OR: [{ initiatorId: userId }, { receiverId: userId }],
          status: 'ACCEPTED',
          type: { not: 'NORMAL' },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { initiator: true, receiver: true },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const friendIds = friendships.map(f => f.initiatorId === userId ? f.receiverId : f.initiatorId);
    const [follows, { muteSet, blockSet }] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followerId: userId, followingId: { in: friendIds }, status: 'ACCEPTED' },
        select: { followingId: true },
      }),
      this.getMuteBlockSets(userId, friendIds),
    ]);
    const followingSet = new Set(follows.map(f => f.followingId));

    const data = await Promise.all(
      friendships.map(async (f) => {
        const friend = f.initiatorId === userId ? f.receiver : f.initiator;
        return this.mapUser(friend, {
          status: 'friend',
          relationshipDate: f.updatedAt,
          relationshipType: f.type,
          mutualFriends: await this.getMutualFriendCount(userId, friend.userId),
          menuItems: getMenuItemsForContext('close-friends', {
            isFriend: true,
            isFollowing: followingSet.has(friend.userId),
            isMuted: muteSet.has(friend.userId),
            isBlocked: blockSet.has(friend.userId),
          }),
        });
      }),
    );

    return {
      statusCode: 200,
      data,
      meta: { pagination: this.buildPagination(page, pageSize, total), timestamp: new Date().toISOString() },
    };
  }

  // ── Mutual Friends ───────────────────────────────────────
  async getMutualFriends(userId: string, targetId: string, page: number, pageSize: number) {
    logger.info('Getting mutual friends', { userId, targetId, page, pageSize });

    // Friends of userId
    const userFriendships = await this.prisma.friendship.findMany({
      where: {
        OR: [{ initiatorId: userId }, { receiverId: userId }],
        status: 'ACCEPTED',
      },
      select: { initiatorId: true, receiverId: true },
    });
    const userFriendIds = new Set(
      userFriendships.flatMap((f) =>
        [f.initiatorId, f.receiverId].filter((id) => id !== userId),
      ),
    );

    // Friends of targetId
    const targetFriendships = await this.prisma.friendship.findMany({
      where: {
        OR: [{ initiatorId: targetId }, { receiverId: targetId }],
        status: 'ACCEPTED',
      },
      select: { initiatorId: true, receiverId: true },
    });
    const targetFriendIds = [...targetFriendships
      .flatMap((f) => [f.initiatorId, f.receiverId].filter((id) => id !== targetId))
      .filter((id) => userFriendIds.has(id))];

    const total = targetFriendIds.length;
    const pageIds = targetFriendIds.slice((page - 1) * pageSize, page * pageSize);

    const mutuals = await this.prisma.userProfile.findMany({
      where: { userId: { in: pageIds } },
    });

    return {
      statusCode: 200,
      data: mutuals.map((u) => this.mapUser(u)),
      meta: { pagination: this.buildPagination(page, pageSize, total), timestamp: new Date().toISOString() },
    };
  }
}
