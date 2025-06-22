import { Module } from '@nestjs/common';
import { UserTypeService } from './user_type.service';
import { UserTypeController } from './user_type.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  controllers: [UserTypeController],
  providers: [UserTypeService],
  imports: [PrismaModule],
})
export class UserTypeModule {}
