import { Module } from '@nestjs/common';
import { EventBusService } from '@platform/common';
import { appConfig } from '../config/app.config';

/**
 * Event Bus Module
 * Provides EventBusService for inter-service communication via Redis Pub/Sub
 */
@Module({
  providers: [
    {
      provide: EventBusService,
      useFactory: () => {
        const redisUrl = process.env.REDIS_URL || 
          `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
        return new EventBusService(redisUrl);
      },
    },
  ],
  exports: [EventBusService],
})
export class EventModule {}
