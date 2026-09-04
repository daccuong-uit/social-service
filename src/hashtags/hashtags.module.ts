import { Module } from '@nestjs/common';
import { HashtagsController } from './hashtags.controller';
import { HashtagsService } from './hashtags.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [HashtagsController],
  providers: [HashtagsService],
  exports: [HashtagsService],
})
export class HashtagsModule {}
