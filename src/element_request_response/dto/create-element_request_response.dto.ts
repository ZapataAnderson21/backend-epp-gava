import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsPositive, Min } from "class-validator";

export class CreateElementRequestResponseDto {
  @ApiProperty({example: 1})
  @Type (() => Number)
  @IsInt()
  @IsPositive()
  elementRequestId!: number;

  @ApiProperty({example: 100})
  @Type (() => Number)
  @IsInt()
  @IsPositive()
  requestResponseId!: number;

  @ApiProperty({example: 10})
  @Type (() => Number)
  @IsInt()
  @Min(0, { message: 'La cantidad aceptada no puede ser negativa.' })
  quantityAccepted!: number;
}
