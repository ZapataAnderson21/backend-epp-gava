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

export class MonthlyEvaluationResponseInputDto {
  @ApiProperty()
  @IsInt()
  monthlyEvaluationQuestionId!: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 3, description: 'Solo aplica para preguntas de tipo score.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  score?: number;

  @ApiPropertyOptional({ description: 'Solo aplica para preguntas de tipo text.' })
  @IsOptional()
  @IsString()
  textAnswer?: string;
}

export class CreateWorkerMonthlyEvaluationDto {
  @ApiProperty()
  @IsInt()
  workerId!: number;

  @ApiProperty()
  @IsInt()
  monthlyEvaluationTemplateVersionId!: number;

  @ApiProperty({ example: 2026 })
  @IsInt()
  year!: number;

  @ApiProperty({ example: 3, minimum: 1, maximum: 12 })
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @ApiPropertyOptional({ default: 1, description: 'Permite multiples evaluaciones por mes en el futuro.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  sequence?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  generalComment?: string;

  @ApiPropertyOptional({ type: [MonthlyEvaluationResponseInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MonthlyEvaluationResponseInputDto)
  responses?: MonthlyEvaluationResponseInputDto[];
}
