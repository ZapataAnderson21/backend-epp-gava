import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsPositive, IsString } from "class-validator";

export class CreateElementRequestDto {
  @ApiProperty()
  @IsNumber()
  @IsPositive()
  quantity_requested: number;

  @ApiProperty()
  @IsString()
  unit: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  element_id: number;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  request_id: number;
}
