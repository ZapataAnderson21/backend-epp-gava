import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDisposalDto {
  @ApiProperty({ example: 2, description: 'Cantidad a dar de baja' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'La cantidad debe ser numerica.' })
  @IsPositive()
  quantity!: number;

  @ApiProperty({ example: 1, description: 'ID del usuario que realiza la baja' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  performedByUserId!: number;

  @ApiProperty({ example: 'Danado por uso excesivo.', description: 'Motivo de la baja' })
  @IsString()
  @MinLength(3, { message: 'El motivo debe tener al menos 3 caracteres.' })
  reason!: string;

  @ApiPropertyOptional({ example: 'Se verifico con supervisor.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
