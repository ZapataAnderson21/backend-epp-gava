import { Module } from '@nestjs/common';
import { ProjectWeeklyPayrollController } from './project-weekly-payroll.controller';
import { ProjectWeeklyPayrollService } from './project-weekly-payroll.service';

@Module({
  controllers: [ProjectWeeklyPayrollController],
  providers: [ProjectWeeklyPayrollService],
})
export class ProjectWeeklyPayrollModule {}
