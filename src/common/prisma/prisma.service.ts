import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client-social';
import { createLogger } from '@platform/logger';

const logger = createLogger({ service: 'social-service:prisma' });

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    logger.info('Social DB connection established');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    logger.info('Social DB connection closed');
  }
}
