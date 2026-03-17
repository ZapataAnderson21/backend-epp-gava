import { Module } from '@nestjs/common';
import { QuotationService } from './quotation.service';
import { QuotationController } from './quotation.controller';
import { PdfService } from 'src/pdf/pdf.service';

@Module({
  controllers: [QuotationController],
  providers: [QuotationService, PdfService],
})
export class QuotationModule {}
