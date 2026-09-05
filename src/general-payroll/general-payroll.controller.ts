import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { UserTypes } from 'src/decorators/user-types.decorator';
import { ConfigureGeneralPayrollDto } from './dto/configure-general-payroll.dto';
import { InitializeGeneralPayrollDto } from './dto/initialize-general-payroll.dto';
import { SaveGeneralPayrollDto } from './dto/save-general-payroll.dto';
import { UpdateGeneralPayrollProjectWorkersDto } from './dto/update-general-payroll-project-workers.dto';
import { GeneralPayrollService } from './general-payroll.service';
import { GeneralPayrollExcelService } from './general-payroll-excel.service';

@Controller('general-payroll')
@UserTypes('GERENTE', 'ADMINISTRADOR', 'ADMINISTRADORA', 'LOGISTICA')
export class GeneralPayrollController {
  constructor(
    private readonly generalPayrollService: GeneralPayrollService,
    private readonly generalPayrollExcelService: GeneralPayrollExcelService,
  ) {}

  @Get('projects/:projectId/totals')
  findProjectTotals(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.generalPayrollService.findProjectTotals(projectId);
  }

  @Get('projects/:projectId')
  findByProject(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.generalPayrollService.findByProject(projectId);
  }

  @Get('weeks')
  findWeeks() {
    return this.generalPayrollService.findWeeks();
  }

  @Get('weeks/:weekId/export/excel')
  async exportWeek(
    @Param('weekId', ParseIntPipe) weekId: number,
    @Res() response: Response,
  ) {
    const { buffer, fileName } =
      await this.generalPayrollExcelService.generateWeekWorkbook(weekId);
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`,
    );
    response.setHeader('Content-Length', buffer.length);
    response.end(buffer);
  }

  @Get('weeks/:weekId')
  findOne(@Param('weekId', ParseIntPipe) weekId: number) {
    return this.generalPayrollService.findOne(weekId);
  }

  @Post('weeks/:weekId/initialize')
  initialize(
    @Param('weekId', ParseIntPipe) weekId: number,
    @Body() dto: InitializeGeneralPayrollDto,
  ) {
    return this.generalPayrollService.initialize(weekId, dto);
  }

  @Put('weeks/:weekId/configuration')
  configure(
    @Param('weekId', ParseIntPipe) weekId: number,
    @Body() dto: ConfigureGeneralPayrollDto,
  ) {
    return this.generalPayrollService.configure(weekId, dto);
  }

  @Put('weeks/:weekId/projects/:payrollProjectId/workers')
  updateProjectWorkers(
    @Param('weekId', ParseIntPipe) weekId: number,
    @Param('payrollProjectId', ParseIntPipe) payrollProjectId: number,
    @Body() dto: UpdateGeneralPayrollProjectWorkersDto,
  ) {
    return this.generalPayrollService.updateProjectWorkers(
      weekId,
      payrollProjectId,
      dto,
    );
  }

  @Put('weeks/:weekId')
  save(
    @Param('weekId', ParseIntPipe) weekId: number,
    @Body() dto: SaveGeneralPayrollDto,
  ) {
    return this.generalPayrollService.save(weekId, dto);
  }
}
