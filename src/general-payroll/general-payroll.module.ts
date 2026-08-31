import { Module } from '@nestjs/common';
import { GeneralPayrollController } from './general-payroll.controller';
import { GeneralPayrollService } from './general-payroll.service';

@Module({
  controllers: [GeneralPayrollController],
  providers: [GeneralPayrollService],
})
export class GeneralPayrollModule {}
