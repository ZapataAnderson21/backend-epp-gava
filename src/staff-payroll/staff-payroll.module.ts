import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { StaffPayrollController } from './staff-payroll.controller';
import { StaffPayrollExcelService } from './staff-payroll-excel.service';
import { StaffPayrollService } from './staff-payroll.service';

@Module({
  imports: [PrismaModule],
  controllers: [StaffPayrollController],
  providers: [StaffPayrollService, StaffPayrollExcelService],
})
export class StaffPayrollModule {}
