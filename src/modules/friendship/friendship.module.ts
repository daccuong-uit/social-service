import { Module } from '@nestjs/common';
import { FriendshipController } from './controllers/friendship.controller';
import { FriendshipService } from './services/friendship.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FriendshipController],
  providers: [FriendshipService],
  exports: [FriendshipService],
})
export class FriendshipModule {}
