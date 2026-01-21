import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateRequestResponseDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  responderUserId!: number;

  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  requestId!: number;

  @ApiPropertyOptional({ example: 'Descripción de gerencia' })
  @IsOptional()
  @IsString()
  managementDescription?: string;

  @ApiPropertyOptional({ example: 'Descripción de logística' })
  @IsOptional()
  @IsString()
  logisticsDescription?: string;

  @ApiPropertyOptional({ example: 'Descripción de administración' })
  @IsOptional()
  @IsString()
  adminDescription?: string;
}
