import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class RegisterWorkerAssignmentDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  workerId!: number;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  performedByUserId!: number;

  @ApiPropertyOptional({ example: 'Entrega inicial en obra.' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: '2026-05-19T05:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  assignedAt?: string;
}
