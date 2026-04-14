import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReplaceElementRequestWorkerPlanItemDto {
  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  requestWorkerId!: number;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'La cantidad planificada debe ser numerica.' },
  )
  @Min(0, { message: 'La cantidad planificada no puede ser negativa.' })
  plannedQuantity!: number;

  @ApiProperty({ example: 'M', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  size?: string;

  @ApiProperty({ example: 'Priorizar para brigada de campo.', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReplaceElementRequestWorkerPlansDto {
  @ApiProperty({
    type: [ReplaceElementRequestWorkerPlanItemDto],
    example: [
      {
        requestWorkerId: 12,
        plannedQuantity: 1,
        size: 'M',
        notes: 'Entrega prevista al recibir el lote.',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReplaceElementRequestWorkerPlanItemDto)
  plans!: ReplaceElementRequestWorkerPlanItemDto[];
}
