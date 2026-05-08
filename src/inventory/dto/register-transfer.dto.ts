import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class RegisterTransferDto {
  @ApiProperty({ example: 3, description: 'ID del proyecto destino' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  targetProjectId!: number;

  @ApiProperty({ example: 2, description: 'Cantidad a transferir' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'La cantidad debe ser numerica.' })
  @IsPositive()
  quantity!: number;

  @ApiProperty({ example: 1, description: 'ID del usuario que realiza la transferencia' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  performedByUserId!: number;

  @ApiProperty({ example: 5, description: 'ID del usuario responsable en el proyecto destino' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  responsibleUserId!: number;

  @ApiPropertyOptional({ example: 'Transferencia por necesidad urgente.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
