import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsPositive,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class RegisterAdjustmentDto {
  @ApiProperty({ example: 8, description: 'Nueva cantidad corregida' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'La cantidad debe ser numerica.' })
  @Min(0, { message: 'La cantidad no puede ser negativa.' })
  newQuantity!: number;

  @ApiProperty({ example: 1, description: 'ID del usuario que realiza el ajuste' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  performedByUserId!: number;

  @ApiProperty({ example: 'Conteo fisico revelo diferencia.', description: 'Motivo del ajuste' })
  @IsString()
  @MinLength(3, { message: 'El motivo debe tener al menos 3 caracteres.' })
  reason!: string;

  @ApiPropertyOptional({ example: 'Se ajusto tras inventario mensual.' })
  @IsString()
  notes?: string;
}
