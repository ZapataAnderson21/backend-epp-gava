import { Module } from '@nestjs/common';
import { PurchaseOrderService } from './purchase-order.service';
import { PurchaseOrderController } from './purchase-order.controller';
import { PdfService } from 'src/pdf/pdf.service';
import { NotificationModule } from 'src/notification/notification.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PurchaseOrderDraftController } from './purchase-order-draft.controller';
import { PurchaseOrderDraftService } from './purchase-order-draft.service';

@Module({
  imports: [NotificationModule, PrismaModule],
  controllers: [PurchaseOrderController, PurchaseOrderDraftController],
  providers: [PurchaseOrderService, PdfService, PurchaseOrderDraftService],
})
export class PurchaseOrderModule {}
