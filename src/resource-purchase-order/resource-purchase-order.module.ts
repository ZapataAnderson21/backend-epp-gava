import { Module } from '@nestjs/common';
import { ResourcePurchaseOrderService } from './resource-purchase-order.service';
import { ResourcePurchaseOrderController } from './resource-purchase-order.controller';

@Module({
  controllers: [ResourcePurchaseOrderController],
  providers: [ResourcePurchaseOrderService],
})
export class ResourcePurchaseOrderModule {}
