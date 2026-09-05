import { Module } from '@nestjs/common';
import { HashtagsController } from './controllers/hashtags.controller';
import { HashtagsService } from './services/hashtags.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [HashtagsController],
  providers: [HashtagsService],
  exports: [HashtagsService],
})
export class HashtagsModule {}
