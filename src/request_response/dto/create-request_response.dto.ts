import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateRequestResponseDto {
  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsInt()
  requestId!: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  responderUserId!: number;

  @ApiPropertyOptional({ example: 'Aprobada parcialmente' })
  @IsOptional()
  @IsString()
  description?: string;
}
