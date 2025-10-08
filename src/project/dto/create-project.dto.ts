import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ProjectStatus } from '../enum/project-status.enum';
import { Type } from 'class-transformer';

export class CreateProjectDto {
  @ApiProperty({ example: 'Proyecto A' })
  @IsString()
  @IsNotEmpty({ message: "El nombre del proyecto es requerido." })
  name!: string;

  @ApiProperty({ example: 'PROY-A' })
  @IsString()
  @IsNotEmpty({ message: "El código del proyecto es requerido." })
  code!: string;

  @ApiPropertyOptional({ example: 'Descripción del proyecto A' })
  @IsString()
  @IsOptional()
  description?: string;
  
  @ApiProperty({ enum: ProjectStatus, enumName: 'ProjectStatus', example: ProjectStatus.Active })
  @IsOptional()
  @IsEnum(ProjectStatus, { message: `Estado de proyecto inválido. Los valores permitidos son: ${Object.values(ProjectStatus).join(', ')}.` })
  status?: ProjectStatus;

  @ApiProperty({ example: 'Lima, Perú' })
  @IsString()
  location!: string;

  @ApiPropertyOptional({ example: '2025-10-05T00:00:00.000Z' })
  @IsOptional()
  @IsDate()
  @Type(() => Date) 
  startDate?: string;
  
  @ApiPropertyOptional({ example: '2025-12-31T00:00:00.000Z' })
  @IsOptional()
  @IsDate()
  @Type(() => Date) 
  endDate?: string;
}