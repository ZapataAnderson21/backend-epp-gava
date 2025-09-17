import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateUserTypeDto {
  @ApiProperty()
  @IsString()
  name: string;
}
