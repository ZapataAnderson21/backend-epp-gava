import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFallProtectionGroupDto {
  @ApiProperty({ example: 'EPA-001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  code!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  harnessElementId!: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  anchorBandElementId!: number;

  @ApiProperty({ example: 3 })
  @IsInt()
  lifelineElementId!: number;

  @ApiProperty({ example: 4 })
  @IsInt()
  positioningLanyardElementId!: number;

  @ApiPropertyOptional({ example: 'Grupo EPA completo para obra.' })
  @IsOptional()
  @IsString()
  description?: string;
}
