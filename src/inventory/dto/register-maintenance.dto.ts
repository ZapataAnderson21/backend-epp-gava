import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class RegisterMaintenanceDto {
  @ApiProperty({ example: 1, description: 'Cantidad (usualmente 1 para items unicos)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'La cantidad debe ser numerica.' })
  @IsPositive()
  quantity!: number;

  @ApiProperty({ example: 1, description: 'ID del usuario que realiza el movimiento' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  performedByUserId!: number;

  @ApiPropertyOptional({ example: 'Enviado a calibracion anual.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
