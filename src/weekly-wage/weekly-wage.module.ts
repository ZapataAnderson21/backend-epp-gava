import { Module } from '@nestjs/common';
import { WeeklyWageService } from './weekly-wage.service';
import { WeeklyWageController } from './weekly-wage.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ExcelModule } from 'src/excel/excel.module';

@Module({
  imports: [PrismaModule, ExcelModule],
  controllers: [WeeklyWageController],
  providers: [WeeklyWageService],
})
export class WeeklyWageModule {}
