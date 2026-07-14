import { Module } from '@nestjs/common';
import { MailService } from 'src/mail/mail.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ExpiringDocumentController } from './expiring-document.controller';
import { ExpiringDocumentService } from './expiring-document.service';
import { ExpiringDocumentTasks } from './expiring-document.tasks';

@Module({
  imports: [PrismaModule],
  controllers: [ExpiringDocumentController],
  providers: [ExpiringDocumentService, ExpiringDocumentTasks, MailService],
  exports: [ExpiringDocumentService],
})
export class ExpiringDocumentModule {}
