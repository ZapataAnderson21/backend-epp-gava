import { PartialType } from '@nestjs/mapped-types';
import { CreateProjectDto } from './create-project.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ProjectStatus } from '../enum/project-status.enum';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @ApiPropertyOptional({ example: 'active' })
  @IsOptional()
  @IsEnum(ProjectStatus, {
    message: `Estado de proyecto inválido. Los valores permitidos son: ${Object.values(ProjectStatus).join(', ')}.`,
  })
  status?: ProjectStatus;
}
