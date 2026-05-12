import { Module } from '@nestjs/common';
import { PettyCashService } from './petty-cash.service';
import { PettyCashController } from './petty-cash.controller';
import { ExcelModule } from 'src/excel/excel.module';

@Module({
  imports: [ExcelModule],
  controllers: [PettyCashController],
  providers: [PettyCashService],
})
export class PettyCashModule {}
