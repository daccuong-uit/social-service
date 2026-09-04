import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserEventListenersService } from './event-listeners.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EventModule } from '../events/event.module';

@Module({
  imports: [PrismaModule, EventModule],
  controllers: [UsersController],
  providers: [UsersService, UserEventListenersService],
  exports: [UsersService],
})
export class UsersModule {}
