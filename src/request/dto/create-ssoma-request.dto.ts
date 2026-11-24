import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { SsomaRequestKind } from '../enum';
import { IsEnum } from 'class-validator';

export class SsomaRequestWorkerPlanDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  workerId!: number;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  quantity!: number;
}

export class SsomaRequestLineDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  elementId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  elementVariantId?: number | null;

  @ApiProperty({ minimum: 0.0001 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  quantity!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  unit!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ type: [SsomaRequestWorkerPlanDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SsomaRequestWorkerPlanDto)
  workerPlans?: SsomaRequestWorkerPlanDto[];
}

export class CreateSsomaRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  clientRequestId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  projectId!: number;

  @ApiProperty({ enum: SsomaRequestKind })
  @IsEnum(SsomaRequestKind)
  ssomaRequestKind!: SsomaRequestKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  deliveryDueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiProperty({ type: [SsomaRequestLineDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Agrega al menos un recurso SSOMA.' })
  @ValidateNested({ each: true })
  @Type(() => SsomaRequestLineDto)
  lines!: SsomaRequestLineDto[];
}
