import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class SaveStaffPayrollRowDto {
  @ApiProperty({ example: 7 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  workerId!: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  included!: boolean;

  @ApiPropertyOptional({ example: 3500, minimum: 0.01 })
  @ValidateIf((row: SaveStaffPayrollRowDto) => row.included)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  baseRemuneration?: number;

  @ApiPropertyOptional({ example: 250, default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  additionalIncome?: number;

  @ApiPropertyOptional({ example: 100, default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  manualDiscounts?: number;

  @ApiPropertyOptional({ example: 'Bono por cumplimiento', nullable: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsString()
  @MaxLength(2000)
  observations?: string | null;

  @ApiPropertyOptional({
    default: false,
    description:
      'Actualiza explícitamente la remuneración habitual para períodos futuros.',
  })
  @IsOptional()
  @IsBoolean()
  updateProfile?: boolean;
}

export class SaveStaffPayrollDto {
  @ApiProperty({ example: 2026, minimum: 1900, maximum: 9999 })
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(9999)
  year!: number;

  @ApiProperty({ example: 11, minimum: 1, maximum: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @ApiPropertyOptional({
    default: false,
    description:
      'Indica que el editor abrió un período existente y permite actualizarlo.',
  })
  @IsOptional()
  @IsBoolean()
  expectExisting?: boolean;

  @ApiProperty({ type: [SaveStaffPayrollRowDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique((row: SaveStaffPayrollRowDto) => row.workerId)
  @ValidateNested({ each: true })
  @Type(() => SaveStaffPayrollRowDto)
  rows!: SaveStaffPayrollRowDto[];
}
