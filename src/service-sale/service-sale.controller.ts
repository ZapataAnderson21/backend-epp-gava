import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ServiceSaleService } from './service-sale.service';
import { CreateServiceSaleDto } from './dto/create-service-sale.dto';
import { UpdateServiceSaleDto } from './dto/update-service-sale.dto';

@Controller('service-sale')
export class ServiceSaleController {
  constructor(private readonly serviceSaleService: ServiceSaleService) {}

  @Post()
  create(@Body() createServiceSaleDto: CreateServiceSaleDto) {
    return this.serviceSaleService.create(createServiceSaleDto);
  }

  @Get()
  findAll() {
    return this.serviceSaleService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.serviceSaleService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateServiceSaleDto: UpdateServiceSaleDto) {
    return this.serviceSaleService.update(+id, updateServiceSaleDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.serviceSaleService.remove(+id);
  }
}
