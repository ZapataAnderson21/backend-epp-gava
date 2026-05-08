import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  Min,
} from 'class-validator';

export class CreateElementRequestResponseDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  elementRequestId!: number;

  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  requestResponseId!: number;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'La cantidad aceptada debe ser numerica.' },
  )
  @Min(0, { message: 'La cantidad aceptada no puede ser negativa.' })
  quantityAccepted!: number;

  @ApiProperty({ example: [1, 2], required: false })
  @IsOptional()
  @IsArray({ message: 'Los equipos seleccionados deben enviarse como lista.' })
  @ArrayUnique({ message: 'No puedes seleccionar dos veces el mismo equipo.' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'Cada equipo seleccionado debe tener un id valido.' })
  @IsPositive({
    each: true,
    message: 'Cada equipo seleccionado debe tener un id mayor a cero.',
  })
  selectedElementIds?: number[];
}
