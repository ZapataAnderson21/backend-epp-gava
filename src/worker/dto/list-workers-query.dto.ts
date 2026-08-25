import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { SearchPaginationQueryDto } from 'src/common/pagination';
import { WorkerType } from '../enum/worker-type.enum';

export class ListWorkersQueryDto extends SearchPaginationQueryDto {
  @ApiPropertyOptional({ enum: WorkerType })
  @IsOptional()
  @IsEnum(WorkerType)
  workerType?: WorkerType;
}
