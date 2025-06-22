import { ApiProperty } from "@nestjs/swagger";

export class ElementRequest {
  @ApiProperty()
  element_request_id: number;
  
  @ApiProperty()
  quantity_requested: number;
  
  @ApiProperty()
  unit: string;
  
  @ApiProperty()
  element_id: number;

  @ApiProperty()
  request_id: number;
}
