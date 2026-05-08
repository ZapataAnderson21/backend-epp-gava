import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class RegisterOfficeEntryDto {
  @ApiProperty({ example: 5, description: 'ID del elemento a ingresar' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  elementId!: number;

  @ApiProperty({ example: 10, description: 'Cantidad a ingresar' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'La cantidad debe ser numerica.' })
  @IsPositive()
  quantity!: number;

  @ApiProperty({ example: 'und', description: 'Unidad de medida' })
  @IsString()
  unit!: string;

  @ApiProperty({ example: 1, description: 'ID del usuario que realiza el ingreso' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  performedByUserId!: number;

  @ApiPropertyOptional({ example: 3, description: 'ID de la orden de compra asociada' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  purchaseOrderId?: number;

  @ApiPropertyOptional({ example: 'Ingreso por compra directa.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
