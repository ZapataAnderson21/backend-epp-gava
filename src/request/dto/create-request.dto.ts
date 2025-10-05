import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus, RequestType } from '../enum';
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRequestDto {

  @ApiProperty({ example: '2025-10-20T00:00:00.000Z' })
  @IsDateString()
  deliveryDueDate!: string;

  @ApiPropertyOptional({ enum: RequestStatus, enumName: 'RequestStatus', example: RequestStatus.Draft })
  @IsEnum(RequestStatus)
  @IsOptional()
  status?: RequestStatus;

  @ApiPropertyOptional({ example: 'No description provided.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: RequestType, enumName: 'RequestType', example: RequestType.Epp })
  @IsEnum(RequestType)
  @IsNotEmpty({ message: 'El tipo de solicitud es requerido.' })
  type!: RequestType;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  userId!: number;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  projectId!: number;
}
