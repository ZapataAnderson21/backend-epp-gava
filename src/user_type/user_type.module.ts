import { Module } from '@nestjs/common';
import { UserTypeService } from './user_type.service';
import { UserTypeController } from './user_type.controller';

@Module({
  controllers: [UserTypeController],
  providers: [UserTypeService],
})
export class UserTypeModule {}
