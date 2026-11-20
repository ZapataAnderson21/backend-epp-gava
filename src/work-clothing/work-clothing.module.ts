import { Module } from '@nestjs/common';
import { PdfService } from 'src/pdf/pdf.service';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { WorkClothingController } from './work-clothing.controller';
import { WorkClothingService } from './work-clothing.service';

@Module({
  imports: [PrismaModule, PermissionsModule],
  controllers: [WorkClothingController],
  providers: [WorkClothingService, PdfService],
})
export class WorkClothingModule {}
