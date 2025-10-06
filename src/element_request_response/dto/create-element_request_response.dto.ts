import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsPositive, Min } from "class-validator";

export class CreateElementRequestResponseDto {
  @ApiProperty({example: 1})
  @Type (() => Number)
  @IsInt()
  @IsPositive()
  element_request_id: number;

  @ApiProperty({example: 100})
  @Type (() => Number)
  @IsInt()
  @IsPositive()
  request_response_id: number;

  @ApiProperty({example: 10})
  @Type (() => Number)
  @IsInt()
  @Min(0, { message: 'La cantidad aceptada no puede ser negativa.' })
  quantity_accepted: number;
}
