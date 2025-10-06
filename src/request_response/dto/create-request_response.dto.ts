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

  @ApiPropertyOptional({ example: 'Aprobada parcialmente' })
  @IsOptional()
  @IsString()
  description?: string;
}
