import { Module } from '@nestjs/common';
import { NovelsController } from './controllers/novels.controller';
import { NovelsService } from './services/novels.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [NovelsController],
  providers: [NovelsService],
  exports: [NovelsService],
})
export class NovelsModule {}
