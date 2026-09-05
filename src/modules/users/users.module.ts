import { Module } from '@nestjs/common';
import { UsersController } from './controllers/users.controller';
import { UsersService } from './services/users.service';
import { UserEventListenersService } from './listeners/user-events.listener';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { EventModule } from '../../common/events/event.module';

@Module({
  imports: [PrismaModule, EventModule],
  controllers: [UsersController],
  providers: [UsersService, UserEventListenersService],
  exports: [UsersService],
})
export class UsersModule {}
