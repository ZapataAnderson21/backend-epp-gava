import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Currency } from 'src/supplier/enum/currency.enum';
import { PurchaseOrderStatus, PurchaseOrderType } from '../enum';

export class PurchaseOrderSummaryQueryDto {
  @ApiPropertyOptional({ description: 'Texto contenido en el código de la OC' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  supplierId?: number;

  @ApiPropertyOptional({ enum: Currency })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional({ enum: PurchaseOrderStatus })
  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;

  @ApiPropertyOptional({ enum: PurchaseOrderType })
  @IsOptional()
  @IsEnum(PurchaseOrderType)
  purchaseOrderType?: PurchaseOrderType;
}
