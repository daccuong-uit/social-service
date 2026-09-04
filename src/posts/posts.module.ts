import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { EventModule } from '../events/event.module';
import { PostLikeCacheService } from './post-like-cache.service';
import { PostLikeEventListenerService } from './post-like-event-listener.service';

@Module({
  imports: [PrismaModule, RedisModule, EventModule],
  controllers: [PostsController],
  providers: [PostsService, PostLikeCacheService, PostLikeEventListenerService],
  exports: [PostsService],
})
export class PostsModule {}
