import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateMonthlyEvaluationQuestionDto {
  @ApiProperty({ example: 'Da buen trato a sus companeros y supervisores.' })
  @IsString()
  @IsNotEmpty()
  prompt!: string;

  @ApiPropertyOptional({ enum: ['score', 'text'], default: 'score' })
  @IsOptional()
  @IsString()
  questionType?: 'score' | 'text';

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isScored?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  minScore?: number;

  @ApiPropertyOptional({ default: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  maxScore?: number;

  @ApiPropertyOptional({
    description: 'Metadata libre para UI/comportamiento de la pregunta.',
    example: { placeholder: 'Comentario opcional' },
  })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class CreateMonthlyEvaluationSectionDto {
  @ApiProperty({ example: 'Seguridad, salud ocupacional y medio ambiente' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ type: [CreateMonthlyEvaluationQuestionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateMonthlyEvaluationQuestionDto)
  questions!: CreateMonthlyEvaluationQuestionDto[];
}

export class CreateMonthlyEvaluationTemplateDto {
  @ApiProperty({ example: 'Reconocimiento al Trabajador - Marzo 2026' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    example: 'Plantilla para evaluacion mensual del personal.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: 20,
    description: 'Umbral maximo para: Trabajador observado.',
  })
  @IsInt()
  @Min(0)
  observedMaxScore!: number;

  @ApiProperty({
    example: 40,
    description: 'Umbral maximo para: Bien, pero puede mejorar.',
  })
  @IsInt()
  @Min(1)
  regularMaxScore!: number;

  @ApiProperty({ type: [CreateMonthlyEvaluationSectionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateMonthlyEvaluationSectionDto)
  sections!: CreateMonthlyEvaluationSectionDto[];
}
