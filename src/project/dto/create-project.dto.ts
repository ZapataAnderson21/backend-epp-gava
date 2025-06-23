import { ApiProperty } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  description: string;

}