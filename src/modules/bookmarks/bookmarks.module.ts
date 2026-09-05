import { Module } from '@nestjs/common';
import { BookmarksController } from './controllers/bookmarks.controller';
import { BookmarksService } from './services/bookmarks.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BookmarksController],
  providers: [BookmarksService],
  exports: [BookmarksService],
})
export class BookmarksModule {}
