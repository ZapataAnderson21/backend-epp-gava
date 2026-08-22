import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateProjectWeeklyPayrollDto {
  @ApiPropertyOptional({ example: 3250.5, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'El monto debe ser mayor o igual a 0.' })
  amount?: number;

  @ApiPropertyOptional({ example: 'Monto actualizado según cierre semanal.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
