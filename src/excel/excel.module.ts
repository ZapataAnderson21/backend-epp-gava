import { Module } from '@nestjs/common';
import { ExcelService } from './excel.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ExcelService],
  exports: [ExcelService],
})
export class ExcelModule {}
