import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class CreateElementDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  type: string;
  
  @ApiProperty()
  @IsString()
  description: string;
}
