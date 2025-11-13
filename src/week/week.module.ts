import { Module } from '@nestjs/common';
import { WeekService } from './week.service';
import { WeekTasks } from './week.tasks';
import { WeekController } from './week.controller';

@Module({
  controllers: [WeekController],
  providers: [WeekService, WeekTasks],
})
export class WeekModule {}
