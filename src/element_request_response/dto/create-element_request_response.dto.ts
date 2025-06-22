import { ApiProperty } from "@nestjs/swagger";

export class CreateElementRequestResponseDto {
  @ApiProperty()
  element_request_id: number;

  @ApiProperty()
  request_response_id: number;

  @ApiProperty()
  quantity_accepted: number;
}
