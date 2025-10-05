import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

export class CreateUserUserTypeDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  userId: number;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsInt()
  userTypeId: number;
}
