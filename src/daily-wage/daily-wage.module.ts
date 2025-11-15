import { Module } from '@nestjs/common';
import { DailyWageService } from './daily-wage.service';
import { DailyWageController } from './daily-wage.controller';

@Module({
  controllers: [DailyWageController],
  providers: [DailyWageService],
})
export class DailyWageModule {}
