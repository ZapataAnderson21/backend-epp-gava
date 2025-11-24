import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { WeekService } from './week.service';

@Injectable()
export class WeekTasks {
  private readonly logger = new Logger(WeekTasks.name);

  constructor(private readonly weekService: WeekService) {}
  
  @Cron('38 1 * * *', {
  })
  async handleCreateWeek() {
    this.logger.log('Verificando y creando semanas faltantes (ejecución diaria a la 1:18 AM)...');
    await this.weekService.ensureWeeksUpToCurrentWeek();
  }
}