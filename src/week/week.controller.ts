import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Logger,
} from '@nestjs/common';
import { WeekService } from './week.service';

@Controller('week')
export class WeekController {
  private readonly logger = new Logger('ProjectController');

  constructor(private readonly weekService: WeekService) {}

  @Get('totals/:projectId')
  async getTotals(@Param('projectId', ParseIntPipe) projectId: number) {
    this.logger.log('Fetching all projects');
    return await this.weekService.getWeeklyPayrollByProject(projectId);
  }
}
