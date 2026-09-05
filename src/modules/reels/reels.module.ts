import { Module } from '@nestjs/common';
import { ReelsController } from './controllers/reels.controller';
import { ReelsService } from './services/reels.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ReelsController],
  providers: [ReelsService],
  exports: [ReelsService],
})
export class ReelsModule {}
