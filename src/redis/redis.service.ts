import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createRedisClient, Redis, RedisClientOptions } from '@platform/redis';
import { appConfig } from '../config/app.config';

@Injectable()
export class RedisService implements OnModuleDestroy {
  public readonly client: Redis;

  constructor() {
    const options: RedisClientOptions = {
      url: appConfig.REDIS_URL,
      host: appConfig.REDIS_HOST,
      port: appConfig.REDIS_PORT,
      password: appConfig.REDIS_PASSWORD,
      db: appConfig.REDIS_DB,
    };

    this.client = createRedisClient(options);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
