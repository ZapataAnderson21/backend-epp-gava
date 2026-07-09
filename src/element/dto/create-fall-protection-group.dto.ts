import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export type FallProtectionComponentRole =
  | 'harness'
  | 'anchorBand'
  | 'lifeline'
  | 'positioningLanyard';

export class FallProtectionGroupComponentDto {
  @ApiProperty({
    enum: ['harness', 'anchorBand', 'lifeline', 'positioningLanyard'],
    example: 'harness',
  })
  @IsString()
  @IsIn(['harness', 'anchorBand', 'lifeline', 'positioningLanyard'])
  role!: FallProtectionComponentRole;

  @ApiProperty({ example: 1 })
  @IsInt()
  elementId!: number;
}

export class CreateFallProtectionGroupDto {
  @ApiProperty({ example: 'EPA-001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  code!: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  harnessElementId?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  anchorBandElementId?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  lifelineElementId?: number;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsInt()
  positioningLanyardElementId?: number;

  @ApiPropertyOptional({ type: [FallProtectionGroupComponentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FallProtectionGroupComponentDto)
  components?: FallProtectionGroupComponentDto[];

  @ApiPropertyOptional({ example: 'Grupo EPA completo para obra.' })
  @IsOptional()
  @IsString()
  description?: string;
}
