import { ApiProperty } from "@nestjs/swagger";

export class CreateElementRequestDto {
  @ApiProperty()
  quantity_requested: number;

  @ApiProperty()
  unit: string;

  @ApiProperty()
  element_id: number;

  @ApiProperty()
  request_id: number;
}
