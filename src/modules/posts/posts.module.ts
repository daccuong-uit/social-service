import { Module } from '@nestjs/common';
import { PostsController } from './controllers/posts.controller';
import { PostsService } from './services/posts.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { EventModule } from '../../common/events/event.module';
import { PostLikeCacheService } from './services/post-like-cache.service';
import { PostLikeEventListenerService } from './listeners/post-like.listener';

@Module({
  imports: [PrismaModule, RedisModule, EventModule],
  controllers: [PostsController],
  providers: [PostsService, PostLikeCacheService, PostLikeEventListenerService],
  exports: [PostsService],
})
export class PostsModule {}
