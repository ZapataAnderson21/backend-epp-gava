import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateElementRequestDto {
  @ApiProperty({ example: 3, minimum: 0 })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'La cantidad solicitada debe ser numerica.' },
  )
  @Min(0, { message: 'La cantidad solicitada no puede ser negativa.' })
  quantityRequested!: number;

  @ApiProperty({ example: 'unidad' })
  @IsString()
  unit!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  elementVariantId?: number | null;

  @ApiProperty({ example: 1, required: false, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0, { message: 'El orden de la linea no puede ser negativo.' })
  lineItemOrder?: number;

  @ApiProperty({
    example: 'Entrega para cuadrilla del frente norte.',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiProperty()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  elementId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  fallProtectionGroupId?: number | null;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  requestId!: number;
}
