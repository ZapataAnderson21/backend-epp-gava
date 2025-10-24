import { Module } from '@nestjs/common';
import { PurchaseOrderService } from './purchase-order.service';
import { PurchaseOrderController } from './purchase-order.controller';
import { PdfService } from 'src/pdf/pdf.service';

@Module({
  controllers: [PurchaseOrderController],
  providers: [PurchaseOrderService, PdfService],
})
export class PurchaseOrderModule {}
