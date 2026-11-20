import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class RequestAdditionWorkerDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  workerId!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  quantity!: number;
}

export class AddRequestResourceDto {
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

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  quantity!: number;

  @ApiProperty()
  @IsString()
  @MaxLength(50)
  unit!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ type: [RequestAdditionWorkerDto] })
  @IsOptional()
  @IsArray()
  @ArrayUnique((item: RequestAdditionWorkerDto) => item.workerId)
  @ValidateNested({ each: true })
  @Type(() => RequestAdditionWorkerDto)
  workerPlans?: RequestAdditionWorkerDto[];
}
