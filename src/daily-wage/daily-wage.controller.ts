import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { DailyWageService } from './daily-wage.service';
import { UpsertWeekDailyWageDto } from './dto/upsert-week-daily-wage.dto';

@Controller('daily-wage')
export class DailyWageController {
  constructor(private readonly dailyWageService: DailyWageService) {}

  @Post('week/:weekId/bulk-upsert')
  upsertForWeek(
    @Param('weekId') weekId: string,
    @Body() body: UpsertWeekDailyWageDto,
  ) {
    return this.dailyWageService.upsertForWeek(+weekId, body);
  }
}
