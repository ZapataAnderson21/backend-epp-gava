import { ApiProperty } from '@nestjs/swagger';

export class UserType {
  @ApiProperty()
  user_type_id!: number;

  @ApiProperty()
  name!: string;
}
