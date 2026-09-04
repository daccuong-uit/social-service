import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createLogger } from '@platform/logger';
import { UpsertReactionDto, RemoveReactionDto } from './dto/reaction.dto';

const logger = createLogger({ service: 'social-service:reactions' });

@Injectable()
export class ReactionsService {
  constructor(private readonly prisma: PrismaService) {}

  private toDbEnum(val: string) {
    return val.toUpperCase() as any;
  }

  // ── Upsert reaction ───────────────────────────────────────
  async upsert(userId: string, dto: UpsertReactionDto) {
    logger.info('Upserting reaction', { userId, ...dto });

    const targetType = this.toDbEnum(dto.targetType);
    const type = this.toDbEnum(dto.type);

    const existing = await this.prisma.reaction.findUnique({
      where: { userId_targetId_targetType: { userId, targetId: dto.targetId, targetType } },
    });

    if (existing) {
      // Update type if different
      if (existing.type !== type) {
        await this.prisma.reaction.update({
          where: { userId_targetId_targetType: { userId, targetId: dto.targetId, targetType } },
          data: { type },
        });
      }
    } else {
      await this.prisma.$transaction(async (tx) => {
        await tx.reaction.create({
          data: { userId, targetId: dto.targetId, targetType, type },
        });
        // Increment likeCount on post/comment for LIKE type
        if (dto.type === 'like') {
          if (dto.targetType === 'post') {
            await tx.post.update({ where: { id: dto.targetId }, data: { likeCount: { increment: 1 } } });
          } else if (dto.targetType === 'comment') {
            await tx.comment.update({ where: { id: dto.targetId }, data: { likeCount: { increment: 1 } } });
          }
        }
      });
    }

    return this.getSummary(dto.targetType, dto.targetId, userId);
  }

  // ── Remove reaction ───────────────────────────────────────
  async remove(userId: string, dto: RemoveReactionDto) {
    logger.info('Removing reaction', { userId, ...dto });

    const targetType = this.toDbEnum(dto.targetType);

    const existing = await this.prisma.reaction.findUnique({
      where: { userId_targetId_targetType: { userId, targetId: dto.targetId, targetType } },
    });

    if (existing) {
      await this.prisma.$transaction(async (tx) => {
        await tx.reaction.delete({
          where: { userId_targetId_targetType: { userId, targetId: dto.targetId, targetType } },
        });
        if (existing.type === 'LIKE') {
          if (dto.targetType === 'post') {
            await tx.post.update({ where: { id: dto.targetId }, data: { likeCount: { decrement: 1 } } });
          } else if (dto.targetType === 'comment') {
            await tx.comment.update({ where: { id: dto.targetId }, data: { likeCount: { decrement: 1 } } });
          }
        }
      });
    }

    return { message: 'Đã xóa reaction' };
  }

  // ── Get Summary ───────────────────────────────────────────
  async getSummary(targetType: string, targetId: string, currentUserId?: string) {
    logger.info('Getting reaction summary', { targetType, targetId });

    const reactions = await this.prisma.reaction.findMany({
      where: { targetId, targetType: this.toDbEnum(targetType) },
      select: { type: true, userId: true },
    });

    // Group by type
    const counts: Record<string, number> = {};
    for (const r of reactions) {
      const key = r.type.toLowerCase();
      counts[key] = (counts[key] ?? 0) + 1;
    }

    const myReaction = currentUserId
      ? reactions.find((r) => r.userId === currentUserId)
      : null;

    return {
      total: reactions.length,
      counts,
      myReaction: myReaction ? myReaction.type.toLowerCase() : null,
    };
  }
}
