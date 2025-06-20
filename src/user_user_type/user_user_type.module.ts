import { Module } from '@nestjs/common';
import { UserUserTypeService } from './user_user_type.service';
import { UserUserTypeController } from './user_user_type.controller';

@Module({
  controllers: [UserUserTypeController],
  providers: [UserUserTypeService],
})
export class UserUserTypeModule {}
