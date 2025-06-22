import { ApiProperty } from "@nestjs/swagger";

export class Request {
  @ApiProperty()
  request_id: number;

  @ApiProperty()
  registration_date: Date;

  @ApiProperty()
  status: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  project_id: number;

  @ApiProperty()
  user_id: number;
}
