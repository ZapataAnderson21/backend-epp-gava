import { Module } from '@nestjs/common';
import { ServiceSaleService } from './service-sale.service';
import { ServiceSaleController } from './service-sale.controller';

@Module({
  controllers: [ServiceSaleController],
  providers: [ServiceSaleService],
})
export class ServiceSaleModule {}
