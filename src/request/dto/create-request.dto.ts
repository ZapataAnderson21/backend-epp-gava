import { ApiProperty } from '@nestjs/swagger';

export class CreateRequestDto {
  
  @ApiProperty()
  registration_date: Date;
  
  @ApiProperty()
  status: string = 'pending';

  @ApiProperty()
  description: string;

  @ApiProperty()
  project_id: number;

  @ApiProperty()
  user_id: number;
}
