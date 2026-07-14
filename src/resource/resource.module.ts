import { Module } from '@nestjs/common';
import { ResourceService } from './resource.service';
import { ResourceController } from './resource.controller';
import { ExcelModule } from 'src/excel/excel.module';

@Module({
  imports: [ExcelModule],
  controllers: [ResourceController],
  providers: [ResourceService],
})
export class ResourceModule {}
