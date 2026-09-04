import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createLogger } from '@platform/logger';
import { CreateGroupDto, UpdateGroupDto, UpdateMemberRoleDto, InviteMembersDto } from './dto/group.dto';
import { MediaResolverService } from '../common/services/media-resolver.service';

const logger = createLogger({ service: 'social-service:groups' });

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaResolver: MediaResolverService,
  ) {}

  private buildPagination(page: number, pageSize: number, totalItems: number) {
    const totalPages = Math.ceil(totalItems / pageSize);
    return { currentPage: page, totalPages, totalItems, itemsPerPage: pageSize, hasNext: page < totalPages };
  }

  private mapGroup(g: any, userId?: string, urlMap: Record<string, any> = {}) {
    const membership = g.members?.find((m: any) => m.userId === userId);
    const coverUrls = g.coverMediaId ? urlMap[g.coverMediaId]?.data : null;

    return {
      id: g.id,
      name: g.name,
      description: g.description,
      coverMediaId: g.coverMediaId,
      coverUrl: coverUrls?.original || null,
      privacy: g.privacy.toLowerCase(),
      memberCount: g.memberCount,
      postCount: g.postCount,
      isJoined: !!membership && membership.status === 'ACTIVE',
      isJoinPending: !!membership && membership.status === 'PENDING',
      myRole: membership ? membership.role.toLowerCase() : null,
      createdAt: g.createdAt,
    };
  }

  private collectGroupMediaIds(groups: any[]): string[] {
    const ids = new Set<string>();
    for (const g of groups) {
      if (g.coverMediaId) ids.add(g.coverMediaId);
    }
    return [...ids];
  }

  private async assertAdminOrModerator(groupId: string, userId: string) {
    const member = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!member || !['ADMIN', 'MODERATOR'].includes(member.role)) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này trong nhóm');
    }
    return member;
  }

  private readonly groupInclude = { members: { select: { userId: true, role: true, status: true } } };

  // ── List / Discover ───────────────────────────────────────
  async list(page: number, pageSize: number, userId?: string) {
    const [total, groups] = await Promise.all([
      this.prisma.group.count({ where: { privacy: 'PUBLIC' } }),
      this.prisma.group.findMany({
        where: { privacy: 'PUBLIC' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { memberCount: 'desc' },
        include: this.groupInclude,
      }),
    ]);
    const urlMap = await this.mediaResolver.resolveBatch(this.collectGroupMediaIds(groups));
    return {
      statusCode: 200,
      data: groups.map((g) => this.mapGroup(g, userId, urlMap)),
      meta: { pagination: this.buildPagination(page, pageSize, total), timestamp: new Date().toISOString() },
    };
  }

  // ── My Groups ─────────────────────────────────────────────
  async getMyGroups(userId: string, page: number, pageSize: number) {
    const [total, memberships] = await Promise.all([
      this.prisma.groupMember.count({ where: { userId, status: 'ACTIVE' } }),
      this.prisma.groupMember.findMany({
        where: { userId, status: 'ACTIVE' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { group: { include: this.groupInclude } },
        orderBy: { joinedAt: 'desc' },
      }),
    ]);
    const urlMap = await this.mediaResolver.resolveBatch(this.collectGroupMediaIds(memberships.map(m => m.group)));
    return {
      statusCode: 200,
      data: memberships.map((m) => this.mapGroup(m.group, userId, urlMap)),
      meta: { pagination: this.buildPagination(page, pageSize, total), timestamp: new Date().toISOString() },
    };
  }

  // ── Get by ID ─────────────────────────────────────────────
  async getById(groupId: string, userId?: string) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId }, include: this.groupInclude });
    if (!group) throw new NotFoundException('Nhóm không tồn tại');
    const urlMap = await this.mediaResolver.resolveBatch(this.collectGroupMediaIds([group]));
    return this.mapGroup(group, userId, urlMap);
  }

  // ── Create ────────────────────────────────────────────────
  async create(userId: string, dto: CreateGroupDto) {
    logger.info('Creating group', { userId, name: dto.name });

    const group = await this.prisma.$transaction(async (tx) => {
      const g = await tx.group.create({
        data: {
          name: dto.name,
          description: dto.description,
          coverMediaId: dto.coverMediaId,
          privacy: (dto.privacy ?? 'public').toUpperCase() as any,
          createdBy: userId,
          memberCount: 1,
        },
      });
      await tx.groupMember.create({
        data: { groupId: g.id, userId, role: 'ADMIN', status: 'ACTIVE' },
      });
      return g;
    });

    return this.getById(group.id, userId);
  }

  // ── Update ────────────────────────────────────────────────
  async update(groupId: string, userId: string, dto: UpdateGroupDto) {
    await this.assertAdminOrModerator(groupId, userId);

    await this.prisma.group.update({
      where: { id: groupId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.coverMediaId !== undefined && { coverMediaId: dto.coverMediaId }),
        ...(dto.privacy && { privacy: dto.privacy.toUpperCase() as any }),
      },
    });

    return this.getById(groupId, userId);
  }

  // ── Delete ────────────────────────────────────────────────
  async delete(groupId: string, userId: string) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Nhóm không tồn tại');
    if (group.createdBy !== userId) throw new ForbiddenException('Chỉ người tạo nhóm mới có thể xóa');

    await this.prisma.group.delete({ where: { id: groupId } });
    return null;
  }

  // ── Join / Leave ──────────────────────────────────────────
  async join(groupId: string, userId: string) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Nhóm không tồn tại');

    const existing = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (existing?.status === 'ACTIVE') throw new ConflictException('Bạn đã là thành viên của nhóm này');
    if (existing?.status === 'PENDING') return { message: 'Yêu cầu tham gia đang chờ duyệt' };

    const status = group.privacy === 'PRIVATE' ? 'PENDING' : 'ACTIVE';

    await this.prisma.$transaction(async (tx) => {
      await tx.groupMember.create({ data: { groupId, userId, role: 'MEMBER', status } });
      if (status === 'ACTIVE') {
        await tx.group.update({ where: { id: groupId }, data: { memberCount: { increment: 1 } } });
      }
    });

    return { message: status === 'ACTIVE' ? 'Đã tham gia nhóm' : 'Đã gửi yêu cầu tham gia nhóm' };
  }

  async leave(groupId: string, userId: string) {
    const member = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!member) throw new NotFoundException('Bạn chưa là thành viên của nhóm này');

    await this.prisma.$transaction(async (tx) => {
      await tx.groupMember.delete({ where: { groupId_userId: { groupId, userId } } });
      if (member.status === 'ACTIVE') {
        await tx.group.update({ where: { id: groupId }, data: { memberCount: { decrement: 1 } } });
      }
    });

    return { message: 'Đã rời khỏi nhóm' };
  }

  // ── Members ───────────────────────────────────────────────
  async getMembers(groupId: string, page: number, pageSize: number, role?: string) {
    const where: any = { groupId, status: 'ACTIVE' };
    if (role) where.role = role.toUpperCase();

    const [total, members] = await Promise.all([
      this.prisma.groupMember.count({ where }),
      this.prisma.groupMember.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: true },
        orderBy: { joinedAt: 'asc' },
      }),
    ]);

    return {
      statusCode: 200,
      data: members.map((m) => ({
        user: { id: m.user.userId, username: m.user.username, displayName: m.user.displayName, avatarMediaId: m.user.avatarMediaId, isVerified: m.user.isVerified },
        role: m.role.toLowerCase(),
        joinedAt: m.joinedAt,
      })),
      meta: { pagination: this.buildPagination(page, pageSize, total), timestamp: new Date().toISOString() },
    };
  }

  async removeMember(groupId: string, targetUserId: string, requesterId: string) {
    await this.assertAdminOrModerator(groupId, requesterId);

    const member = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });
    if (!member) throw new NotFoundException('Thành viên không tồn tại trong nhóm');

    await this.prisma.$transaction(async (tx) => {
      await tx.groupMember.delete({ where: { groupId_userId: { groupId, userId: targetUserId } } });
      if (member.status === 'ACTIVE') {
        await tx.group.update({ where: { id: groupId }, data: { memberCount: { decrement: 1 } } });
      }
    });

    return { message: 'Đã xóa thành viên khỏi nhóm' };
  }

  async updateMemberRole(groupId: string, targetUserId: string, requesterId: string, dto: UpdateMemberRoleDto) {
    await this.assertAdminOrModerator(groupId, requesterId);

    await this.prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId: targetUserId } },
      data: { role: dto.role.toUpperCase() as any },
    });

    return { message: 'Đã cập nhật vai trò thành viên' };
  }

  // ── Invite ────────────────────────────────────────────────
  async invite(groupId: string, requesterId: string, dto: InviteMembersDto) {
    await this.assertAdminOrModerator(groupId, requesterId);

    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Nhóm không tồn tại');

    let added = 0;
    for (const userId of dto.userIds) {
      const existing = await this.prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId } },
      });
      if (!existing) {
        await this.prisma.$transaction(async (tx) => {
          await tx.groupMember.create({ data: { groupId, userId, role: 'MEMBER', status: 'ACTIVE' } });
          await tx.group.update({ where: { id: groupId }, data: { memberCount: { increment: 1 } } });
        });
        added++;
      }
    }

    return { message: `Đã mời ${added} thành viên vào nhóm` };
  }

  // ── Join Requests (private group) ─────────────────────────
  async getJoinRequests(groupId: string, requesterId: string, page: number, pageSize: number) {
    await this.assertAdminOrModerator(groupId, requesterId);

    const [total, requests] = await Promise.all([
      this.prisma.groupMember.count({ where: { groupId, status: 'PENDING' } }),
      this.prisma.groupMember.findMany({
        where: { groupId, status: 'PENDING' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: true },
        orderBy: { joinedAt: 'asc' },
      }),
    ]);

    return {
      statusCode: 200,
      data: requests.map((m) => ({
        id: m.user.userId, username: m.user.username, displayName: m.user.displayName, avatarMediaId: m.user.avatarMediaId,
      })),
      meta: { pagination: this.buildPagination(page, pageSize, total), timestamp: new Date().toISOString() },
    };
  }

  async approveJoinRequest(groupId: string, targetUserId: string, requesterId: string) {
    await this.assertAdminOrModerator(groupId, requesterId);

    const member = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });
    if (!member || member.status !== 'PENDING') throw new NotFoundException('Yêu cầu tham gia không tồn tại');

    await this.prisma.$transaction(async (tx) => {
      await tx.groupMember.update({
        where: { groupId_userId: { groupId, userId: targetUserId } },
        data: { status: 'ACTIVE' },
      });
      await tx.group.update({ where: { id: groupId }, data: { memberCount: { increment: 1 } } });
    });

    return { message: 'Đã chấp nhận yêu cầu tham gia nhóm' };
  }

  async rejectJoinRequest(groupId: string, targetUserId: string, requesterId: string) {
    await this.assertAdminOrModerator(groupId, requesterId);

    await this.prisma.groupMember.deleteMany({
      where: { groupId, userId: targetUserId, status: 'PENDING' },
    });

    return { message: 'Đã từ chối yêu cầu tham gia nhóm' };
  }

  // ── Group Feed ────────────────────────────────────────────
  async getFeed(groupId: string, page: number, pageSize: number, userId?: string) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Nhóm không tồn tại');

    const [total, posts] = await Promise.all([
      this.prisma.post.count({ where: { groupId, isDeleted: false } }),
      this.prisma.post.findMany({
        where: { groupId, isDeleted: false },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { author: true },
      }),
    ]);

    return {
      statusCode: 200,
      data: posts.map((p) => ({
        id: p.id,
        author: { id: p.author.userId, username: p.author.username, displayName: p.author.displayName, avatarMediaId: p.author.avatarMediaId },
        type: p.type.toLowerCase(),
        content: p.content,
        mediaIds: p.mediaIds,
        likeCount: p.likeCount,
        commentCount: p.commentCount,
        createdAt: p.createdAt,
      })),
      meta: { pagination: this.buildPagination(page, pageSize, total), timestamp: new Date().toISOString() },
    };
  }
}
