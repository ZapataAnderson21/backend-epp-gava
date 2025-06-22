import { ApiProperty } from '@nestjs/swagger';

export class CreateRequestResponseDto {
  @ApiProperty()
  request_id: number;

  @ApiProperty()
  responder_user_id: number;

  @ApiProperty()
  response_date: Date;

  @ApiProperty()
  status: string;

  @ApiProperty()
  description: string;
}
