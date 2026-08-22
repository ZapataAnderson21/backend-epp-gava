import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { UserTypes } from 'src/decorators/user-types.decorator';
import { CreateProjectWeeklyPayrollDto } from './dto/create-project-weekly-payroll.dto';
import { UpdateProjectWeeklyPayrollDto } from './dto/update-project-weekly-payroll.dto';
import { ProjectWeeklyPayrollService } from './project-weekly-payroll.service';

@Controller('project-weekly-payroll')
@UserTypes('GERENTE', 'ADMINISTRADOR', 'ADMINISTRADORA')
export class ProjectWeeklyPayrollController {
  constructor(
    private readonly projectWeeklyPayrollService: ProjectWeeklyPayrollService,
  ) {}

  @Get('project/:projectId/weeks')
  findWeeksForProject(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.projectWeeklyPayrollService.findWeeksForProject(projectId);
  }

  @Get('project/:projectId')
  findAllByProject(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.projectWeeklyPayrollService.findAllByProject(projectId);
  }

  @Post()
  create(@Body() dto: CreateProjectWeeklyPayrollDto) {
    return this.projectWeeklyPayrollService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjectWeeklyPayrollDto,
  ) {
    return this.projectWeeklyPayrollService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.projectWeeklyPayrollService.remove(id);
  }
}
