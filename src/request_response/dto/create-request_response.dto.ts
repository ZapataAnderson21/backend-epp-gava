import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateRequestResponseDto {
  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  requestId!: number;

  @ApiPropertyOptional({ example: 'Descripción de gerencia' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  managementDescription?: string;

  @ApiPropertyOptional({ example: 'Descripción de logística' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  logisticsDescription?: string;

  @ApiPropertyOptional({ example: 'Descripción de administración' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  adminDescription?: string;
}
