import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsPositive } from 'class-validator';
import { SearchPaginationQueryDto } from 'src/common/pagination';
import { PurchaseOrderStatus, PurchaseOrderType } from '../enum';

export class ListGlobalPurchaseOrdersQueryDto extends SearchPaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  supplierId?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  projectId?: number;

  @ApiPropertyOptional({ enum: PurchaseOrderType })
  @IsOptional()
  @IsEnum(PurchaseOrderType)
  purchaseOrderType?: PurchaseOrderType;

  @ApiPropertyOptional({ enum: PurchaseOrderStatus })
  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;
}
