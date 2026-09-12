import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SendRequestLogisticsDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  requestId!: number;

  @ApiProperty()
  @IsString()
  @MaxLength(256)
  passwordCPanel!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  operationId?: string;
}
