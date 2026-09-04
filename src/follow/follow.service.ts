import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createLogger } from '@platform/logger';
import { getMenuItemsForContext } from '../common/utils/menu-config';

const logger = createLogger({ service: 'social-service:follow' });

@Injectable()
export class FollowService {
  constructor(private readonly prisma: PrismaService) {}

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

  private mapUser(u: any, overrides: Record<string, any> = {}) {
    return {
      id: u.userId ?? u.id,
      name: u.displayName ?? u.username ?? u.name ?? 'Unknown',
      avatar: u.avatarUrl ?? u.avatar ?? null,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      bio: u.bio,
      isVerified: u.isVerified,
      isPrivate: u.isPrivate,
      followerCount: u.followerCount,
      followingCount: u.followingCount,
      postCount: u.postCount,
      ...overrides
    };
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

  // ── Follow ───────────────────────────────────────────────
  async follow(followerId: string, followingId: string) {
    logger.info('Follow request', { followerId, followingId });

    if (followerId === followingId) {
      throw new ConflictException('Không thể tự follow chính mình');
    }

    const target = await this.prisma.userProfile.findUnique({
      where: { userId: followingId },
    });

    if (!target) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    // Check if already blocked
    const blocked = await this.prisma.userBlock.findUnique({
      where: { blockerId_blockedId: { blockerId: followingId, blockedId: followerId } },
    });
    if (blocked) {
      throw new ForbiddenException('Không thể follow người dùng này');
    }

    const existing = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });

    if (existing) {
      return {
        followerCount: target.followerCount,
        isFollowedByCurrentUser: existing.status === 'ACCEPTED',
        isPending: existing.status === 'PENDING',
      };
    }

    // Private account → PENDING, public → ACCEPTED
    const status = target.isPrivate ? 'PENDING' : 'ACCEPTED';

    await this.prisma.$transaction(async (tx) => {
      await tx.follow.create({ data: { followerId, followingId, status } });

      if (status === 'ACCEPTED') {
        await tx.userProfile.update({
          where: { userId: followingId },
          data: { followerCount: { increment: 1 } },
        });
        await tx.userProfile.update({
          where: { userId: followerId },
          data: { followingCount: { increment: 1 } },
        });
      }
    });

    const updated = await this.prisma.userProfile.findUnique({
      where: { userId: followingId },
    });

    return {
      followerCount: updated!.followerCount,
      isFollowedByCurrentUser: status === 'ACCEPTED',
      isPending: status === 'PENDING',
    };
  }

  // ── Unfollow ─────────────────────────────────────────────
  async unfollow(followerId: string, followingId: string) {
    logger.info('Unfollow request', { followerId, followingId });

    const existing = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });

    if (!existing) {
      return { message: 'Đã unfollow thành công' };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.follow.delete({
        where: { followerId_followingId: { followerId, followingId } },
      });

      if (existing.status === 'ACCEPTED') {
        await tx.userProfile.update({
          where: { userId: followingId },
          data: { followerCount: { decrement: 1 } },
        });
        await tx.userProfile.update({
          where: { userId: followerId },
          data: { followingCount: { decrement: 1 } },
        });
      }
    });

    return { message: 'Đã unfollow thành công' };
  }

  // ── Remove Follower (xóa người theo dõi mình) ────────────
  async removeFollower(ownerId: string, followerId: string) {
    logger.info('Removing follower', { ownerId, followerId });

    const follow = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId: ownerId } },
    });

    if (!follow) {
      return { message: 'Không có người theo dõi này' };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.follow.delete({
        where: { followerId_followingId: { followerId, followingId: ownerId } },
      });
      if (follow.status === 'ACCEPTED') {
        await tx.userProfile.update({
          where: { userId: ownerId },
          data: { followerCount: { decrement: 1 } },
        });
        await tx.userProfile.update({
          where: { userId: followerId },
          data: { followingCount: { decrement: 1 } },
        });
      }
    });

    return { message: 'Đã xóa người theo dõi' };
  }

  // ── Followers ────────────────────────────────────────────
  async getFollowers(userId: string, page: number, pageSize: number) {
    logger.info('Getting followers', { userId, page, pageSize });

    const [total, follows] = await Promise.all([
      this.prisma.follow.count({
        where: { followingId: userId, status: 'ACCEPTED' },
      }),
      this.prisma.follow.findMany({
        where: { followingId: userId, status: 'ACCEPTED' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { follower: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const followerIds = follows.map(f => f.followerId);
    const [friendships, { muteSet: followerMuteSet, blockSet: followerBlockSet }] = await Promise.all([
      this.prisma.friendship.findMany({
        where: {
          OR: [
            { initiatorId: userId, receiverId: { in: followerIds } },
            { receiverId: userId, initiatorId: { in: followerIds } }
          ],
          status: 'ACCEPTED'
        }
      }),
      this.getMuteBlockSets(userId, followerIds),
    ]);
    const friendSet = new Set(friendships.map(f => f.initiatorId === userId ? f.receiverId : f.initiatorId));

    return {
      statusCode: 200,
      data: follows.map((f) => this.mapUser(f.follower, { menuItems: getMenuItemsForContext('followers', { isFriend: friendSet.has(f.followerId), isMuted: followerMuteSet.has(f.followerId), isBlocked: followerBlockSet.has(f.followerId) }) })),
      meta: { pagination: this.buildPagination(page, pageSize, total), timestamp: new Date().toISOString() },
    };
  }

  // ── Following ────────────────────────────────────────────
  async getFollowing(userId: string, page: number, pageSize: number) {
    logger.info('Getting following', { userId, page, pageSize });

    const [total, follows] = await Promise.all([
      this.prisma.follow.count({
        where: { followerId: userId, status: 'ACCEPTED' },
      }),
      this.prisma.follow.findMany({
        where: { followerId: userId, status: 'ACCEPTED' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { following: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const followingIds = follows.map(f => f.followingId);
    const [friendships2, { muteSet: followingMuteSet, blockSet: followingBlockSet }] = await Promise.all([
      this.prisma.friendship.findMany({
        where: {
          OR: [
            { initiatorId: userId, receiverId: { in: followingIds } },
            { receiverId: userId, initiatorId: { in: followingIds } }
          ],
          status: 'ACCEPTED'
        }
      }),
      this.getMuteBlockSets(userId, followingIds),
    ]);
    const friendSet2 = new Set(friendships2.map(f => f.initiatorId === userId ? f.receiverId : f.initiatorId));

    return {
      statusCode: 200,
      data: follows.map((f) => this.mapUser(f.following, { status: 'following', menuItems: getMenuItemsForContext('following', { isFriend: friendSet2.has(f.followingId), isMuted: followingMuteSet.has(f.followingId), isBlocked: followingBlockSet.has(f.followingId) }) })),
      meta: { pagination: this.buildPagination(page, pageSize, total), timestamp: new Date().toISOString() },
    };
  }

  // ── Follow Requests (for private accounts) ───────────────
  async getFollowRequests(userId: string, page: number, pageSize: number) {
    logger.info('Getting follow requests', { userId, page, pageSize });

    const [total, requests] = await Promise.all([
      this.prisma.follow.count({
        where: { followingId: userId, status: 'PENDING' },
      }),
      this.prisma.follow.findMany({
        where: { followingId: userId, status: 'PENDING' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { follower: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      statusCode: 200,
      data: requests.map((r) => this.mapUser(r.follower)),
      meta: { pagination: this.buildPagination(page, pageSize, total), timestamp: new Date().toISOString() },
    };
  }

  // ── Approve Follow Request ───────────────────────────────
  async approveFollowRequest(ownerId: string, requesterId: string) {
    logger.info('Approving follow request', { ownerId, requesterId });

    const follow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId: requesterId, followingId: ownerId },
      },
    });

    if (!follow || follow.status !== 'PENDING') {
      throw new NotFoundException('Không tìm thấy yêu cầu follow');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.follow.update({
        where: { followerId_followingId: { followerId: requesterId, followingId: ownerId } },
        data: { status: 'ACCEPTED' },
      });
      await tx.userProfile.update({
        where: { userId: ownerId },
        data: { followerCount: { increment: 1 } },
      });
      await tx.userProfile.update({
        where: { userId: requesterId },
        data: { followingCount: { increment: 1 } },
      });
    });

    return { message: 'Đã chấp nhận yêu cầu follow' };
  }

  // ── Reject Follow Request ────────────────────────────────
  async rejectFollowRequest(ownerId: string, requesterId: string) {
    logger.info('Rejecting follow request', { ownerId, requesterId });

    await this.prisma.follow.deleteMany({
      where: { followerId: requesterId, followingId: ownerId, status: 'PENDING' },
    });

    return { message: 'Đã từ chối yêu cầu follow' };
  }
}
