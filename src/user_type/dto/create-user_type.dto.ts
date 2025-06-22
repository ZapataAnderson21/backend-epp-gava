import { ApiProperty } from '@nestjs/swagger';

export class CreateUserTypeDto {
  @ApiProperty()
  name: string;
}
