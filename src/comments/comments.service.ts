import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { createLogger } from '@platform/logger';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';

const logger = createLogger({ service: 'social-service:comments' });

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private buildPagination(page: number, pageSize: number, totalItems: number) {
    const totalPages = Math.ceil(totalItems / pageSize);
    return { currentPage: page, totalPages, totalItems, itemsPerPage: pageSize, hasNext: page < totalPages };
  }

  private extractMentionUsernames(content: string): string[] {
    const mentions = content.match(/@([a-zA-Z0-9._-]+)/g) ?? [];
    return Array.from(new Set(mentions.map((mention) => mention.slice(1).toLowerCase())));
  }

  private async notifyMentions(authorId: string, content: string, targetId: string, mentionedUserIds: string[] = []) {
    const normalizedUserIds = Array.from(new Set((mentionedUserIds ?? []).filter(Boolean)));
    const usernames = this.extractMentionUsernames(content);

    let mentionedUsers: Array<{ userId: string; username?: string }> = normalizedUserIds.map((userId) => ({ userId }));

    if (!mentionedUsers.length && usernames.length) {
      mentionedUsers = await this.prisma.userProfile.findMany({
        where: { username: { in: usernames } },
        select: { userId: true, username: true },
      });
    }

    const notifications = mentionedUsers
      .filter((user) => user.userId !== authorId)
      .map((user) => ({
        userId: user.userId,
        actorId: authorId,
        type: 'POST_MENTION',
        targetId,
        targetType: 'COMMENT',
        content: `Bạn được nhắc đến trong một bình luận`,
      }));

    await Promise.all(notifications.map((notification) => this.notificationsService.push(notification)));
  }

  private async resolveTopLevelParentId(postId: string | null, parentId?: string | null, reelId?: string | null) {
    if (!parentId) {
      return null;
    }

    let currentParentId = parentId;
    const visited = new Set<string>();

    while (currentParentId) {
      if (visited.has(currentParentId)) {
        break;
      }
      visited.add(currentParentId);

      const currentComment = await this.prisma.comment.findUnique({
        where: { id: currentParentId },
        select: { id: true, parentId: true, postId: true, reelId: true },
      });

      if (!currentComment || (postId && currentComment.postId !== postId) || (reelId && currentComment.reelId !== reelId)) {
        throw new NotFoundException('Comment cha không tồn tại');
      }

      if (!currentComment.parentId) {
        return currentComment.id;
      }

      currentParentId = currentComment.parentId;
    }

    return currentParentId ?? null;
  }

  private mapComment(c: any, currentUserId?: string, reactionMap?: Map<string, boolean>) {
    const isLikedByCurrentUser = currentUserId
    ? Boolean(c.commentLikes?.length)
    : false;

    return {
      id: c.id,
      postId: c.postId ?? null,
      reelId: c.reelId ?? null,
      parentId: c.parentId ?? null,
      author: c.author
        ? { id: c.author.userId, username: c.author.username, displayName: c.author.displayName, avatarUrl: c.author.avatarUrl, isVerified: c.author.isVerified }
        : null,
      content: c.content,
      mentionedUsers: Array.isArray(c.mentionedUsers) ? c.mentionedUsers : [],
      mentionRanges: Array.isArray(c.mentionRanges) ? c.mentionRanges : [],
      isPinned: c.isPinned,
      likeCount: c.likeCount,
      isLikedByCurrentUser,
      replyCount: c.replyCount,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  // ── List comments of a post ───────────────────────────────
  async listByPost(postId: string, page: number, pageSize: number, currentUserId?: string) {
    logger.info('Listing comments', { postId, page });

    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.isDeleted) throw new NotFoundException('Bài đăng không tồn tại');

    const [total, comments] = await Promise.all([
      this.prisma.comment.count({ where: { postId, parentId: null, isDeleted: false } }),
      this.prisma.comment.findMany({
        where: { postId, parentId: null, isDeleted: false },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'asc' }],
        include: {
          author: true,
          commentLikes: currentUserId
            ? { where: { userId: currentUserId }, select: { id: true } }
            : false,
        },
      }),
    ]);

    return {
      statusCode: 200,
      data: comments.map((c) => this.mapComment(c, currentUserId)),
      meta: {
        pagination: this.buildPagination(page, pageSize, total),
        timestamp: new Date().toISOString(),
      },
    };
  }

  // ── List comments of a reel ───────────────────────────────
  async listByReel(reelId: string, page: number, pageSize: number, currentUserId?: string) {
    logger.info('Listing reel comments', { reelId, page });

    const reel = await this.prisma.reel.findUnique({ where: { id: reelId } });
    if (!reel || reel.isDeleted) throw new NotFoundException('Reel không tồn tại');

    const [total, comments] = await Promise.all([
      this.prisma.comment.count({ where: { reelId, parentId: null, isDeleted: false } }),
      this.prisma.comment.findMany({
        where: { reelId, parentId: null, isDeleted: false },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'asc' }],
        include: {
          author: true,
          commentLikes: currentUserId
            ? { where: { userId: currentUserId }, select: { id: true } }
            : false,
        },
      }),
    ]);

    return {
      statusCode: 200,
      data: comments.map((c) => this.mapComment(c, currentUserId)),
      meta: {
        pagination: this.buildPagination(page, pageSize, total),
        timestamp: new Date().toISOString(),
      },
    };
  }

  // ── Create comment ────────────────────────────────────────
  async create(postId: string, authorId: string, dto: CreateCommentDto) {
    logger.info('Creating comment', { postId, authorId });

    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.isDeleted) throw new NotFoundException('Bài đăng không tồn tại');

    const resolvedParentId = await this.resolveTopLevelParentId(postId, dto.parentId);

    const comment = await this.prisma.$transaction(async (tx) => {
      const c = await tx.comment.create({
        data: {
          postId,
          authorId,
          content: dto.content,
          parentId: resolvedParentId,
          mentionRanges: (dto.mentionRanges ?? []) as any,
        } as any,
        include: { author: true },
      });
      await tx.post.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } });
      if (resolvedParentId) {
        await tx.comment.update({ where: { id: resolvedParentId }, data: { replyCount: { increment: 1 } } });
      }
      return c;
    });

    await this.notifyMentions(authorId, dto.content, comment.id, dto.mentionedUserIds ?? dto.mentionRanges?.map((range) => range.userId) ?? []);

    return this.mapComment(comment, authorId, new Map());
  }

  // ── Create comment for reel ───────────────────────────────
  async createForReel(reelId: string, authorId: string, dto: CreateCommentDto) {
    logger.info('Creating reel comment', { reelId, authorId });

    const reel = await this.prisma.reel.findUnique({ where: { id: reelId } });
    if (!reel || reel.isDeleted) throw new NotFoundException('Reel không tồn tại');

    const resolvedParentId = await this.resolveTopLevelParentId(null, dto.parentId, reelId);

    const comment = await this.prisma.$transaction(async (tx) => {
      const c = await tx.comment.create({
        data: {
          reelId,
          authorId,
          content: dto.content,
          parentId: resolvedParentId,
          mentionRanges: (dto.mentionRanges ?? []) as any,
        } as any,
        include: { author: true },
      });
      await tx.reel.update({ where: { id: reelId }, data: { commentCount: { increment: 1 } } });
      if (resolvedParentId) {
        await tx.comment.update({ where: { id: resolvedParentId }, data: { replyCount: { increment: 1 } } });
      }
      return c;
    });

    await this.notifyMentions(authorId, dto.content, comment.id, dto.mentionedUserIds ?? dto.mentionRanges?.map((range) => range.userId) ?? []);

    return this.mapComment(comment, authorId, new Map());
  }

  // ── Update comment ────────────────────────────────────────
  async update(commentId: string, authorId: string, dto: UpdateCommentDto) {
    logger.info('Updating comment', { commentId, authorId });

    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.isDeleted) throw new NotFoundException('Comment không tồn tại');
    if (comment.authorId !== authorId) throw new ForbiddenException('Bạn không có quyền chỉnh sửa comment này');

    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { content: dto.content },
      include: { author: true },
    });

    await this.notifyMentions(authorId, dto.content, updated.id, []);

    return this.mapComment(updated, authorId, new Map());
  }

  // ── Delete comment ────────────────────────────────────────
  async delete(commentId: string, authorId: string) {
    logger.info('Deleting comment', { commentId, authorId });

    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.isDeleted) throw new NotFoundException('Comment không tồn tại');
    if (comment.authorId !== authorId) throw new ForbiddenException('Bạn không có quyền xóa comment này');

    await this.prisma.$transaction(async (tx) => {
      await tx.comment.update({ where: { id: commentId }, data: { isDeleted: true } });
      if (comment.postId) {
        await tx.post.update({ where: { id: comment.postId }, data: { commentCount: { decrement: 1 } } });
      } else if (comment.reelId) {
        await tx.reel.update({ where: { id: comment.reelId }, data: { commentCount: { decrement: 1 } } });
      }
      if (comment.parentId) {
        await tx.comment.update({ where: { id: comment.parentId }, data: { replyCount: { decrement: 1 } } });
      }
    });

    return null;
  }

  // ── Replies ───────────────────────────────────────────────
  async getReplies(commentId: string, page: number, pageSize: number, currentUserId?: string) {
    logger.info('Getting replies', { commentId, page });

    const parent = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!parent || parent.isDeleted) throw new NotFoundException('Comment không tồn tại');

    const [total, replies] = await Promise.all([
      this.prisma.comment.count({ where: { parentId: commentId, isDeleted: false } }),
      this.prisma.comment.findMany({
        where: { parentId: commentId, isDeleted: false },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'asc' },
        include: {
          author: true,
          commentLikes: currentUserId
            ? { where: { userId: currentUserId }, select: { id: true } }
            : false,
        },
      }),
    ]);

    const reactionMap = new Map<string, boolean>();
    replies.forEach((comment) => {
      reactionMap.set(comment.id, Boolean(comment.commentLikes?.length));
    });

    return {
      data: replies.map((c) => this.mapComment(c, currentUserId, reactionMap)),
      meta: { pagination: this.buildPagination(page, pageSize, total) },
    };
  }

  // ── Pin / Unpin ───────────────────────────────────────────
  async pin(commentId: string, userId: string) {
    logger.info('Pinning comment', { commentId, userId });

    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: { post: true, reel: true },
    });
    if (!comment || comment.isDeleted) throw new NotFoundException('Comment không tồn tại');
    
    const targetAuthorId = comment.post?.authorId || comment.reel?.authorId;
    if (targetAuthorId !== userId) throw new ForbiddenException('Chỉ tác giả bài đăng mới có thể ghim comment');

    // Unpin any existing pinned comment on this post or reel first
    if (comment.postId) {
      await this.prisma.comment.updateMany({
        where: { postId: comment.postId, isPinned: true },
        data: { isPinned: false },
      });
    } else if (comment.reelId) {
      await this.prisma.comment.updateMany({
        where: { reelId: comment.reelId, isPinned: true },
        data: { isPinned: false },
      });
    }

    await this.prisma.comment.update({ where: { id: commentId }, data: { isPinned: true } });
    return { message: 'Đã ghim comment' };
  }

  async likeComment(commentId: string, userId: string) {
    logger.info('Liking comment', { commentId, userId });

    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.isDeleted) throw new NotFoundException('Comment không tồn tại');

    const existingLike = await this.prisma.commentLike.findUnique({
      where: { userId_commentId: { userId, commentId } },
    });

    await this.prisma.$transaction(async (tx) => {
      if (existingLike) {
        return;
      }

      await tx.commentLike.create({
        data: { userId, commentId },
      });

      await tx.comment.update({ where: { id: commentId }, data: { likeCount: { increment: 1 } } });
    });

    const updatedComment = await this.prisma.comment.findUnique({ where: { id: commentId }, select: { likeCount: true } });
    return {
        commentId,
        likeCount: updatedComment?.likeCount ?? comment.likeCount,
        isLikedByCurrentUser: true,
    };
  }

  async unlikeComment(commentId: string, userId: string) {
    logger.info('Unliking comment', { commentId, userId });

    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.isDeleted) throw new NotFoundException('Comment không tồn tại');

    const existingLike = await this.prisma.commentLike.findUnique({
      where: { userId_commentId: { userId, commentId } },
    });

    if (existingLike) {
      await this.prisma.$transaction(async (tx) => {
        await tx.commentLike.delete({
          where: { userId_commentId: { userId, commentId } },
        });
        await tx.comment.update({ where: { id: commentId }, data: { likeCount: { decrement: 1 } } });
      });
    }

    const updatedComment = await this.prisma.comment.findUnique({ where: { id: commentId }, select: { likeCount: true } });
    return {
        commentId,
        likeCount: updatedComment?.likeCount ?? comment.likeCount,
        isLikedByCurrentUser: false,
    };
  }

  async unpin(commentId: string, userId: string) {
    logger.info('Unpinning comment', { commentId, userId });

    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: { post: true, reel: true },
    });
    if (!comment || comment.isDeleted) throw new NotFoundException('Comment không tồn tại');
    
    const targetAuthorId = comment.post?.authorId || comment.reel?.authorId;
    if (targetAuthorId !== userId) throw new ForbiddenException('Chỉ tác giả bài đăng mới có thể bỏ ghim');

    await this.prisma.comment.update({ where: { id: commentId }, data: { isPinned: false } });
    return { message: 'Đã bỏ ghim comment' };
  }

  // ── Report ────────────────────────────────────────────────
  async report(commentId: string, userId: string, reason: string, description?: string) {
    logger.info('Reporting comment', { commentId, userId, reason });
    // TODO: persist to moderation queue
    return { message: 'Đã gửi báo cáo thành công' };
  }
}
