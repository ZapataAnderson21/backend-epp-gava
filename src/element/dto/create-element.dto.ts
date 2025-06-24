import { ApiProperty } from "@nestjs/swagger";

export class CreateElementDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  type: string;
  
  @ApiProperty()
  description: string;
}
