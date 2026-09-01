import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { Currency } from 'src/generated/prisma';
import { SearchPaginationQueryDto } from 'src/common/pagination';

export class ListServiceSalesQueryDto extends SearchPaginationQueryDto {
  @ApiPropertyOptional({ enum: Currency })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;
}
