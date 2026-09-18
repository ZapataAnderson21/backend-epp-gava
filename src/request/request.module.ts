import { Module } from '@nestjs/common';
import { RequestService } from './request.service';
import { RequestController } from './request.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { PdfService } from 'src/pdf/pdf.service';
import { MailService } from 'src/mail/mail.service';
import { NotificationModule } from 'src/notification/notification.module';
import { InventoryModule } from 'src/inventory/inventory.module';
import { RequestFormDraftController } from './request-form-draft.controller';
import { RequestFormDraftService } from './request-form-draft.service';

@Module({
  imports: [NotificationModule, InventoryModule],
  controllers: [RequestController, RequestFormDraftController],
  providers: [
    RequestService,
    PrismaService,
    PdfService,
    MailService,
    RequestFormDraftService,
  ],
})
export class RequestModule {}
