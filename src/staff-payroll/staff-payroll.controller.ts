import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  AddStaffPayrollEntriesDto,
  ConfigureStaffPayrollProfileDto,
  CreateStaffPayrollDto,
  ListStaffPayrollsQueryDto,
  ListStaffPeopleQueryDto,
  PrepareStaffPayrollQueryDto,
  SaveStaffPayrollDto,
  UpdateStaffPayrollEntryDto,
} from './dto';
import { StaffPayrollExcelService } from './staff-payroll-excel.service';
import { StaffPayrollService } from './staff-payroll.service';

@Controller('staff-payroll')
export class StaffPayrollController {
  constructor(
    private readonly service: StaffPayrollService,
    private readonly excelService: StaffPayrollExcelService,
  ) {}

  @Get('people')
  listPeople(@Query() query: ListStaffPeopleQueryDto) {
    return this.service.listPeople(query);
  }

  @Put('people/:workerId/profile')
  configureProfile(
    @Param('workerId', ParseIntPipe) workerId: number,
    @Body() dto: ConfigureStaffPayrollProfileDto,
  ) {
    return this.service.configureProfile(workerId, dto);
  }

  @Get('periods')
  listPeriods(@Query() query: ListStaffPayrollsQueryDto) {
    return this.service.listPeriods(query);
  }

  @Post('periods')
  createPeriod(@Body() dto: CreateStaffPayrollDto) {
    return this.service.createPeriod(dto);
  }

  @Get('periods/prepare')
  preparePeriod(@Query() query: PrepareStaffPayrollQueryDto) {
    return this.service.preparePeriod(query.year, query.month);
  }

  @Put('periods')
  savePeriod(@Body() dto: SaveStaffPayrollDto) {
    return this.service.savePeriod(dto);
  }

  @Get('periods/:year/:month/eligible')
  listEligiblePeople(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
  ) {
    return this.service.listEligiblePeople(year, month);
  }

  @Post('periods/:year/:month/entries')
  addEntries(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Body() dto: AddStaffPayrollEntriesDto,
  ) {
    return this.service.addEntries(year, month, dto);
  }

  @Get('periods/:year/:month/export')
  async exportPeriod(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Res() response: Response,
  ) {
    const { buffer, fileName } = await this.excelService.generatePeriodWorkbook(
      year,
      month,
    );
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="' + fileName + '"',
    );
    response.setHeader('Content-Length', buffer.length);
    response.end(buffer);
  }

  @Get('periods/:year/:month')
  getPeriod(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
  ) {
    return this.service.getPeriod(year, month);
  }

  @Patch('entries/:entryId')
  updateEntry(
    @Param('entryId', ParseIntPipe) entryId: number,
    @Body() dto: UpdateStaffPayrollEntryDto,
  ) {
    return this.service.updateEntry(entryId, dto);
  }
}
