import { PartialType } from '@nestjs/swagger';
import { CreateResourcePurchaseOrderDto } from './create-resource-purchase-order.dto';

export class UpdateResourcePurchaseOrderDto extends PartialType(
  CreateResourcePurchaseOrderDto,
) {}
