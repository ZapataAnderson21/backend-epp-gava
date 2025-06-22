import { Module } from '@nestjs/common';
import { UserUserTypeService } from './user_user_type.service';
import { UserUserTypeController } from './user_user_type.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  controllers: [UserUserTypeController],
  providers: [UserUserTypeService],
  imports: [PrismaModule]
})
export class UserUserTypeModule {}
