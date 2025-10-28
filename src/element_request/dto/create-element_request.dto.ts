import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsNumber, IsPositive, IsString, Min } from "class-validator";

export class CreateElementRequestDto {
  @ApiProperty({ example: 3, minimum: 0 })
  @Type(() => Number)
  @IsInt({ message: 'La cantidad solicitada debe ser un número entero.' })
  @Min(0, { message: 'La cantidad solicitada no puede ser negativa.' })
  quantityRequested!: number;

  @ApiProperty({ example: 'unidad' })
  @IsString()
  unit!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  elementId!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  requestId!: number;
}
