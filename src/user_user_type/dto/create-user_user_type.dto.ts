import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class CreateUserUserTypeDto {
  @ApiProperty()
  @IsInt()
  user_id: number;

  @ApiProperty()
  @IsInt()
  user_type_id: number;
}
