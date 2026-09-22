import { OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { CreatePurchaseOrderDto } from './create-purchase-order.dto';
import { CreateResourcePurchaseOrderDto } from '../../resource-purchase-order/dto/create-resource-purchase-order.dto';

export class PurchaseOrderItemDto extends OmitType(
  CreateResourcePurchaseOrderDto,
  ['purchaseOrderId'] as const,
) {}

export class CreateCompletePurchaseOrderDto extends CreatePurchaseOrderDto {
  @IsUUID('4')
  creationKey!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: PurchaseOrderItemDto) => item.resourceId, {
    message: 'No repita el mismo recurso en varias filas de la orden.',
  })
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items!: PurchaseOrderItemDto[];
}
