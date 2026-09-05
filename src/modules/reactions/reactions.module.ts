import { Module } from '@nestjs/common';
import { ReactionsController } from './controllers/reactions.controller';
import { ReactionsService } from './services/reactions.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ReactionsController],
  providers: [ReactionsService],
  exports: [ReactionsService],
})
export class ReactionsModule {}
