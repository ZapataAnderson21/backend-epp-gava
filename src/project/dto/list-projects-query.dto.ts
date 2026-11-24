import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { SearchPaginationQueryDto } from 'src/common/pagination';
import { ProjectStatus } from '../enum/project-status.enum';
import { ProjectType } from '../enum/project-type.enum';

export class ListProjectsQueryDto extends SearchPaginationQueryDto {
  @ApiPropertyOptional({ enum: ProjectStatus })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({ enum: ProjectType })
  @IsOptional()
  @IsEnum(ProjectType)
  type?: ProjectType;
}
