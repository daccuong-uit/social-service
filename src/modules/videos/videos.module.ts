import { Module } from '@nestjs/common';
import { VideosController } from './controllers/videos.controller';
import { VideosService } from './services/videos.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [VideosController],
  providers: [VideosService],
  exports: [VideosService],
})
export class VideosModule {}
