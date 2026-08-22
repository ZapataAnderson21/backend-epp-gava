import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateProjectWeeklyPayrollDto {
  @ApiProperty({ example: 17 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  projectId!: number;

  @ApiProperty({ example: 42 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  weekId!: number;

  @ApiProperty({ example: 3250.5, minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'El monto debe ser mayor o igual a 0.' })
  amount!: number;

  @ApiPropertyOptional({
    example: 'Planilla correspondiente a trabajos en obra.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
