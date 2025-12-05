import { Module } from '@nestjs/common';
import { PurchaseOrderService } from './purchase-order.service';
import { PurchaseOrderController } from './purchase-order.controller';
import { PdfService } from 'src/pdf/pdf.service';
import { NotificationModule } from 'src/notification/notification.module';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [NotificationModule, PrismaModule],
  controllers: [PurchaseOrderController],
  providers: [PurchaseOrderService, PdfService],
})
export class PurchaseOrderModule {}
