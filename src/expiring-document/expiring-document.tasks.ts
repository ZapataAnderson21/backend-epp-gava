import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ExpiringDocumentService } from './expiring-document.service';

@Injectable()
export class ExpiringDocumentTasks {
  private readonly logger = new Logger(ExpiringDocumentTasks.name);

  constructor(private readonly service: ExpiringDocumentService) {}

  @Cron('0 8 * * *', { timeZone: 'America/Lima' })
  async sendDailyExpirationAlerts() {
    this.logger.log('Verificando avisos de vencimientos documentales...');
    await this.service.sendDueAlerts();
  }
}
