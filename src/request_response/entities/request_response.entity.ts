import { ApiProperty } from "@nestjs/swagger";

export class RequestResponse {
  @ApiProperty()
  request_response_id!: number;

  @ApiProperty()
  request_id!: number;

  @ApiProperty()
  responder_user_id!: number;

  @ApiProperty()
  response_date!: Date;

  @ApiProperty()
  description!: string;
}
