import { ApiProperty } from '@nestjs/swagger';

export class CreateUserUserTypeDto {
  @ApiProperty()
  user_id: number;

  @ApiProperty()
  user_type_id: number;
}
