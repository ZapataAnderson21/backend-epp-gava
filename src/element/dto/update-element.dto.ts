import { PartialType } from '@nestjs/mapped-types';
import { CreateElementDto } from './create-element.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectStatus } from 'generated/prisma';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateElementDto extends PartialType(CreateElementDto) {
  @ApiPropertyOptional({example: ProjectStatus.active, enum: ProjectStatus})
  @IsOptional()
  @IsEnum(ProjectStatus, { message: `Estado de proyecto inválido. Los valores permitidos son: ${Object.values(ProjectStatus).join(', ')}.` })
  status?: ProjectStatus;
}
