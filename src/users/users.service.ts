import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createLogger } from '@platform/logger';
import { getMenuItemsForContext } from '../common/utils/menu-config';
import {
  UpdatePrivacySettingsDto,
  UpdateAccountSettingsDto,
} from './dto/user.dto';
import { MediaResolverService } from '../common/services/media-resolver.service';

const logger = createLogger({ service: 'social-service:users' });

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaResolver: MediaResolverService,
  ) {}

  // ── User Creation (Internal - called from event listener) ─
  async createUserProfile(data: {
    userId: string;
    username: string;
    displayName: string;
    email?: string;
    phoneNumber?: string;
  }) {
    logger.info('Creating user profile', { userId: data.userId, username: data.username });

    try {
      // Check if profile already exists
      const existing = await this.prisma.userProfile.findUnique({
        where: { userId: data.userId },
      });

      if (existing) {
        logger.warn('User profile already exists', { userId: data.userId });
        return existing;
      }

      // Create user profile with default settings
      const profile = await this.prisma.userProfile.create({
        data: {
          userId: data.userId,
          username: data.username,
          displayName: data.displayName,
        },
      });

      // Create default privacy settings
      await this.prisma.privacySettings.create({
        data: {
          userId: data.userId,
          isPrivateAccount: false,
          whoCanSeeMyPosts: 'everyone',
          whoCanSendFriendRequest: 'everyone',
          whoCanSeeMyFriendList: 'everyone',
          whoCanTagMe: 'everyone',
        },
      });

      // Create default account settings
      await this.prisma.accountSettings.create({
        data: {
          userId: data.userId,
          language: 'vi',
          emailNotifications: true,
          pushNotifications: true,
          twoFactorEnabled: false,
        },
      });

      logger.info('User profile created successfully', { userId: data.userId });
      return profile;
    } catch (error) {
      logger.error('Failed to create user profile', { userId: data.userId, error });
      throw error;
    }
  }

  // ── Helpers ──────────────────────────────────────────────
  private buildPagination(
    page: number,
    pageSize: number,
    totalItems: number,
  ) {
    const totalPages = Math.ceil(totalItems / pageSize);
    return {
      currentPage: page,
      totalPages,
      totalItems,
      itemsPerPage: pageSize,
      hasNext: page < totalPages,
    };
  }

  private mapProfile(u: any, urlMap: Record<string, any> = {}) {
    const avatarUrls = u.avatarMediaId ? urlMap[u.avatarMediaId]?.data : null;
    return {
      id: u.userId,
      username: u.username,
      displayName: u.displayName,
      avatarMediaId: u.avatarMediaId,
      avatarUrl: avatarUrls?.thumbnail || avatarUrls?.original || null,
      coverMediaId: u.coverMediaId,
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

  private collectUserMediaIds(users: any[]): string[] {
    const ids = new Set<string>();
    for (const u of users) {
      if (u.avatarMediaId) ids.add(u.avatarMediaId);
    }
    return [...ids];
  }

  // ── Suggestions ──────────────────────────────────────────
  async getSuggestions(currentUserId: string, limit: number) {
    logger.info('Getting user suggestions', { currentUserId, limit });

    // Get users the current user isn't following yet (excluding self)
    const alreadyFollowing = await this.prisma.follow.findMany({
      where: { followerId: currentUserId },
      select: { followingId: true },
    });

    const excludeIds = [
      currentUserId,
      ...alreadyFollowing.map((f: { followingId: string }) => f.followingId),
    ];

    const users = await this.prisma.userProfile.findMany({
      where: { userId: { notIn: excludeIds } },
      take: limit,
      orderBy: { followerCount: 'desc' },
    });

    const urlMap = await this.mediaResolver.resolveBatch(this.collectUserMediaIds(users));

    return {
      statusCode: 200,
      data: users.map((u: any) => this.mapProfile(u, urlMap)),
      meta: { timestamp: new Date().toISOString() },
    };
  }

  // ── Block ────────────────────────────────────────────────
  async blockUser(blockerId: string, blockedId: string) {
    logger.info('Blocking user', { blockerId, blockedId });

    if (blockerId === blockedId) {
      throw new ConflictException('Không thể chặn chính mình');
    }

    await this.prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      create: { blockerId, blockedId },
      update: {},
    });

    return { message: 'Đã chặn người dùng' };
  }

  async unblockUser(blockerId: string, blockedId: string) {
    logger.info('Unblocking user', { blockerId, blockedId });

    await this.prisma.userBlock.deleteMany({
      where: { blockerId, blockedId },
    });

    return { message: 'Đã bỏ chặn người dùng' };
  }

  async getBlockedUsers(userId: string, page: number, pageSize: number) {
    logger.info('Getting blocked users', { userId, page, pageSize });

    const [total, blocked] = await Promise.all([
      this.prisma.userBlock.count({ where: { blockerId: userId } }),
      this.prisma.userBlock.findMany({
        where: { blockerId: userId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { blocked: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const urlMap = await this.mediaResolver.resolveBatch(this.collectUserMediaIds(blocked.map(b => b.blocked)));

    return {
      statusCode: 200,
      data: blocked.map((b) => ({
        ...this.mapProfile(b.blocked, urlMap),
        status: 'blocked',
        relationshipDate: b.createdAt,
        menuItems: getMenuItemsForContext('blocked'),
      })),
      meta: {
        pagination: this.buildPagination(page, pageSize, total),
        timestamp: new Date().toISOString(),
      },
    };
  }

  // ── Mute ─────────────────────────────────────────────────
  async muteUser(muterId: string, mutedId: string) {
    logger.info('Muting user', { muterId, mutedId });

    if (muterId === mutedId) {
      throw new ConflictException('Không thể tắt thông báo từ chính mình');
    }

    await this.prisma.userMute.upsert({
      where: { muterId_mutedId: { muterId, mutedId } },
      create: { muterId, mutedId },
      update: {},
    });

    return { message: 'Đã tắt thông báo từ người dùng này' };
  }

  async unmuteUser(muterId: string, mutedId: string) {
    logger.info('Unmuting user', { muterId, mutedId });

    await this.prisma.userMute.deleteMany({
      where: { muterId, mutedId },
    });

    return { message: 'Đã bật lại thông báo' };
  }

  async getMutedUsers(userId: string, page: number, pageSize: number) {
    logger.info('Getting muted users', { userId, page, pageSize });

    const [total, muted] = await Promise.all([
      this.prisma.userMute.count({ where: { muterId: userId } }),
      this.prisma.userMute.findMany({
        where: { muterId: userId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { muted: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const mutedIds = muted.map(m => m.mutedId);
    const [friendships, blocks] = await Promise.all([
      this.prisma.friendship.findMany({
        where: {
          OR: [
            { initiatorId: userId, receiverId: { in: mutedIds } },
            { receiverId: userId, initiatorId: { in: mutedIds } }
          ],
          status: 'ACCEPTED'
        }
      }),
      this.prisma.userBlock.findMany({
        where: { blockerId: userId, blockedId: { in: mutedIds } },
        select: { blockedId: true },
      }),
    ]);
    const friendSet = new Set(friendships.map(f => f.initiatorId === userId ? f.receiverId : f.initiatorId));
    const blockSet = new Set(blocks.map(b => b.blockedId));

    const urlMap = await this.mediaResolver.resolveBatch(this.collectUserMediaIds(muted.map(m => m.muted)));

    return {
      statusCode: 200,
      data: muted.map((m) => ({
        ...this.mapProfile(m.muted, urlMap),
        status: 'muted',
        relationshipDate: m.createdAt,
        menuItems: getMenuItemsForContext('muted', { isFriend: friendSet.has(m.mutedId), isBlocked: blockSet.has(m.mutedId) }),
      })),
      meta: {
        pagination: this.buildPagination(page, pageSize, total),
        timestamp: new Date().toISOString(),
      },
    };
  }

  // ── Report ───────────────────────────────────────────────
  async reportUser(
    reporterId: string,
    reportedId: string,
    reason: string,
    description?: string,
  ) {
    logger.info('Reporting user', { reporterId, reportedId, reason });
    // TODO: persist to moderation queue
    return { message: 'Đã gửi báo cáo, chúng tôi sẽ xem xét trong thời gian sớm nhất' };
  }

  // ── Privacy Settings ─────────────────────────────────────
  async getPrivacySettings(userId: string) {
    logger.info('Getting privacy settings', { userId });

    const settings = await this.prisma.privacySettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      // Return defaults
      return {
        isPrivateAccount: false,
        whoCanSeeMyPosts: 'everyone',
        whoCanSendFriendRequest: 'everyone',
        whoCanSeeMyFriendList: 'everyone',
        whoCanTagMe: 'everyone',
      };
    }

    return {
      isPrivateAccount: settings.isPrivateAccount,
      whoCanSeeMyPosts: settings.whoCanSeeMyPosts,
      whoCanSendFriendRequest: settings.whoCanSendFriendRequest,
      whoCanSeeMyFriendList: settings.whoCanSeeMyFriendList,
      whoCanTagMe: settings.whoCanTagMe,
    };
  }

  async updatePrivacySettings(userId: string, dto: UpdatePrivacySettingsDto) {
    logger.info('Updating privacy settings', { userId });

    const settings = await this.prisma.privacySettings.upsert({
      where: { userId },
      create: {
        userId,
        ...dto,
      },
      update: {
        ...(dto.isPrivateAccount !== undefined && {
          isPrivateAccount: dto.isPrivateAccount,
        }),
        ...(dto.whoCanSeeMyPosts && { whoCanSeeMyPosts: dto.whoCanSeeMyPosts }),
        ...(dto.whoCanSendFriendRequest && {
          whoCanSendFriendRequest: dto.whoCanSendFriendRequest,
        }),
        ...(dto.whoCanSeeMyFriendList && {
          whoCanSeeMyFriendList: dto.whoCanSeeMyFriendList,
        }),
        ...(dto.whoCanTagMe && { whoCanTagMe: dto.whoCanTagMe }),
      },
    });

    // Sync isPrivate to profile
    if (dto.isPrivateAccount !== undefined) {
      await this.prisma.userProfile.update({
        where: { userId },
        data: { isPrivate: dto.isPrivateAccount },
      });
    }

    return { message: 'Đã cập nhật cài đặt quyền riêng tư' };
  }

  // ── Account Settings ─────────────────────────────────────
  async getAccountSettings(userId: string) {
    logger.info('Getting account settings', { userId });

    const settings = await this.prisma.accountSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      return {
        language: 'vi',
        emailNotifications: true,
        pushNotifications: true,
        twoFactorEnabled: false,
      };
    }

    return {
      language: settings.language,
      emailNotifications: settings.emailNotifications,
      pushNotifications: settings.pushNotifications,
      twoFactorEnabled: settings.twoFactorEnabled,
    };
  }

  async updateAccountSettings(userId: string, dto: UpdateAccountSettingsDto) {
    logger.info('Updating account settings', { userId });

    await this.prisma.accountSettings.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: { ...dto },
    });

    return { message: 'Đã cập nhật cài đặt tài khoản' };
  }
}
