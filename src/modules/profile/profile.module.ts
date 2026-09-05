import { Module } from '@nestjs/common';
import { ProfileController } from './controllers/profile.controller';
import { ProfileService } from './services/profile.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
