import { ApiProperty } from '@nestjs/swagger';
import { UserType } from 'src/user_type/entities/user_type.entity';

export class UserUserType {
  @ApiProperty()
  user_user_type_id!: number;

  @ApiProperty()
  user_id!: number;

  @ApiProperty()
  user_type_id!: number;

  @ApiProperty()
  user_type?: UserType;
}
