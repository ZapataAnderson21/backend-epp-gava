import { Module } from '@nestjs/common';
import { RequestService } from './request.service';
import { RequestController } from './request.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { PdfService } from 'src/pdf/pdf.service';
import { MailService } from 'src/mail/mail.service';
import { NotificationModule } from 'src/notification/notification.module';
import { InventoryModule } from 'src/inventory/inventory.module';

@Module({
  imports: [NotificationModule, InventoryModule],
  controllers: [RequestController],
  providers: [RequestService, PrismaService, PdfService, MailService],
})
export class RequestModule {}
