import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  description: string;
}