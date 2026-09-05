import { Module } from '@nestjs/common';
import { FollowController } from './controllers/follow.controller';
import { FollowService } from './services/follow.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FollowController],
  providers: [FollowService],
  exports: [FollowService],
})
export class FollowModule {}
