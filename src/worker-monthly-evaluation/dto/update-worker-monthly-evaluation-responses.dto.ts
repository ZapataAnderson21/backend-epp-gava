import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class UpdateWorkerMonthlyEvaluationResponseItemDto {
  @ApiProperty()
  @IsInt()
  monthlyEvaluationQuestionId!: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  score?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  textAnswer?: string;
}

export class UpdateWorkerMonthlyEvaluationResponsesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  generalComment?: string;

  @ApiProperty({ type: [UpdateWorkerMonthlyEvaluationResponseItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateWorkerMonthlyEvaluationResponseItemDto)
  responses!: UpdateWorkerMonthlyEvaluationResponseItemDto[];
}
