import { Module } from '@nestjs/common';
import { WeekService } from './week.service';
import { WeekTasks } from './week.tasks';

@Module({
  providers: [WeekService, WeekTasks],
})
export class WeekModule {}
