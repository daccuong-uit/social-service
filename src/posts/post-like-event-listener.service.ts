import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventBusService, DomainEvent } from '@platform/common';
import { PrismaService } from '../prisma/prisma.service';
import { PostLikeCacheService } from './post-like-cache.service';

@Injectable()
export class PostLikeEventListenerService implements OnModuleInit {
  private readonly logger = new Logger(PostLikeEventListenerService.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly postLikeCache: PostLikeCacheService,
    private readonly prisma: PrismaService,
  ) {}

  private async refreshCache(postId: string): Promise<void> {
    const likeCount = await this.prisma.postLike.count({ where: { postId } });
    await this.postLikeCache.set(postId, likeCount);
    this.logger.debug(`Refreshed cache for post ${postId}: ${likeCount}`);
  }

  async onModuleInit(): Promise<void> {
    await this.eventBus.subscribe('post.like.created.v1', async (event: DomainEvent) => {
      const postId = event.payload.postId as string;
      await this.refreshCache(postId);
    });

    await this.eventBus.subscribe('post.like.deleted.v1', async (event: DomainEvent) => {
      const postId = event.payload.postId as string;
      await this.refreshCache(postId);
    });
  }
}
