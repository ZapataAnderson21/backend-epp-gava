import { Module } from '@nestjs/common';
import { PurchaseOrderConditionController } from './purchase-order-condition.controller';
import { PurchaseOrderConditionService } from './purchase-order-condition.service';

@Module({
  controllers: [PurchaseOrderConditionController],
  providers: [PurchaseOrderConditionService],
})
export class PurchaseOrderConditionModule {}
