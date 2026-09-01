import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { UserTypes } from 'src/decorators/user-types.decorator';
import { ConfigureGeneralPayrollDto } from './dto/configure-general-payroll.dto';
import { InitializeGeneralPayrollDto } from './dto/initialize-general-payroll.dto';
import { SaveGeneralPayrollDto } from './dto/save-general-payroll.dto';
import { GeneralPayrollService } from './general-payroll.service';

@Controller('general-payroll')
@UserTypes('GERENTE', 'ADMINISTRADOR', 'ADMINISTRADORA')
export class GeneralPayrollController {
  constructor(private readonly generalPayrollService: GeneralPayrollService) {}

  @Get('projects/:projectId/totals')
  @UserTypes('GERENTE', 'ADMINISTRADOR', 'ADMINISTRADORA', 'LOGISTICA')
  findProjectTotals(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.generalPayrollService.findProjectTotals(projectId);
  }

  @Get('projects/:projectId')
  @UserTypes('GERENTE', 'ADMINISTRADOR', 'ADMINISTRADORA', 'LOGISTICA')
  findByProject(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.generalPayrollService.findByProject(projectId);
  }

  @Get('weeks')
  @UserTypes('GERENTE', 'ADMINISTRADOR', 'ADMINISTRADORA', 'LOGISTICA')
  findWeeks() {
    return this.generalPayrollService.findWeeks();
  }

  @Get('weeks/:weekId')
  @UserTypes('GERENTE', 'ADMINISTRADOR', 'ADMINISTRADORA', 'LOGISTICA')
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

  @Put('weeks/:weekId')
  save(
    @Param('weekId', ParseIntPipe) weekId: number,
    @Body() dto: SaveGeneralPayrollDto,
  ) {
    return this.generalPayrollService.save(weekId, dto);
  }
}
