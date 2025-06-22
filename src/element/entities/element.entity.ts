import { ApiProperty } from "@nestjs/swagger";

export class Element {
  @ApiProperty()
  element_id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;
}
