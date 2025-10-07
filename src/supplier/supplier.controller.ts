import { Controller, Get, Post, Body, Patch, Param, Delete, Logger, ParseIntPipe } from '@nestjs/common';
import { SupplierService } from './supplier.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Controller('supplier')
export class SupplierController {

  private readonly logger = new Logger("SupplierController");

  constructor(private readonly supplierService: SupplierService) {}

  @Post()
  create(@Body() createSupplierDto: CreateSupplierDto) {
    this.logger.log(`Creating supplier: ${JSON.stringify(createSupplierDto)}`);
    return this.supplierService.create(createSupplierDto);
  }

  @Get()
  findAll() {
    this.logger.log(`Finding all suppliers`);
    return this.supplierService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Finding supplier with ID: ${id}`);
    return this.supplierService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateSupplierDto: UpdateSupplierDto) {
    this.logger.log(`Updating supplier with ID: ${id}, Data: ${JSON.stringify(updateSupplierDto)}`);
    return this.supplierService.update(id, updateSupplierDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Removing supplier with ID: ${id}`);
    return this.supplierService.remove(id);
  }
}
