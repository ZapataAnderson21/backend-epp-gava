import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestType } from '../enum';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRequestDto {
  @ApiProperty({ example: '2025-10-20T00:00:00.000Z' })
  @IsDateString()
  deliveryDueDate!: string;

  @ApiPropertyOptional({ example: 'No description provided.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  projectId!: number;

  @ApiProperty({
    enum: RequestType,
    enumName: 'RequestType',
    example: RequestType.Epp,
  })
  @IsEnum(RequestType)
  @IsNotEmpty({ message: 'El tipo de solicitud es requerido.' })
  type!: RequestType;
}
