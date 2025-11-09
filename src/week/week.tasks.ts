import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { WeekService } from './week.service';

@Injectable()
export class WeekTasks {
  private readonly logger = new Logger(WeekTasks.name);

  constructor(private readonly weekService: WeekService) {}
  
  @Cron('0 0 * * 1', {
    timeZone: 'America/Lima',
  })
  async handleCreateWeek() {
    this.logger.log('Creando registro de Week para nueva semana...');
    await this.weekService.createWeekForToday();
  }
}
