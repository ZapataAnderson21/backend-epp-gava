import { Module } from '@nestjs/common';
import { GeneralPayrollController } from './general-payroll.controller';
import { GeneralPayrollService } from './general-payroll.service';
import { GeneralPayrollExcelService } from './general-payroll-excel.service';

@Module({
  controllers: [GeneralPayrollController],
  providers: [GeneralPayrollService, GeneralPayrollExcelService],
})
export class GeneralPayrollModule {}
