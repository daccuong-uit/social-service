import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class PostLikeCacheService {
  private readonly prefix = 'post:likes:';

  constructor(private readonly redisService: RedisService) {}

  getKey(postId: string): string {
    return `${this.prefix}${postId}`;
  }

  async increment(postId: string): Promise<number> {
    return this.redisService.client.incr(this.getKey(postId));
  }

  async decrement(postId: string): Promise<number> {
    const value = await this.redisService.client.decr(this.getKey(postId));
    if (value < 0) {
      await this.redisService.client.set(this.getKey(postId), '0');
      return 0;
    }
    return value;
  }

  async get(postId: string): Promise<number | null> {
    const value = await this.redisService.client.get(this.getKey(postId));
    return value === null ? null : Number(value);
  }

  async set(postId: string, count: number): Promise<void> {
    await this.redisService.client.set(this.getKey(postId), String(count));
  }
}
