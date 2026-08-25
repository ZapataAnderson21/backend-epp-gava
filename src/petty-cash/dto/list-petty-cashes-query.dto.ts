import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { SearchPaginationQueryDto } from 'src/common/pagination';
import { PettyCashType } from '../enum';

export class ListPettyCashesQueryDto extends SearchPaginationQueryDto {
  @ApiPropertyOptional({ enum: PettyCashType })
  @IsOptional()
  @IsEnum(PettyCashType)
  expenseType?: PettyCashType;
}
