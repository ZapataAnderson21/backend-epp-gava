import { Controller, Get, Post, Body, Patch, Param, Delete, Logger, ParseIntPipe } from '@nestjs/common';
import { PurchaseOrderService } from './purchase-order.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';

@Controller('purchase-order')
export class PurchaseOrderController {
  
  private readonly logger = new Logger('PurchaseOrderController');
  
  constructor(private readonly purchaseOrderService: PurchaseOrderService) {}

  @Post()
  create(@Body() createPurchaseOrderDto: CreatePurchaseOrderDto) {
    this.logger.log(`Creating purchase order: ${JSON.stringify(createPurchaseOrderDto)}`);
    return this.purchaseOrderService.create(createPurchaseOrderDto);
  }

  @Get('project/:projectId')
  findAllByProjectId(@Param('projectId', ParseIntPipe) projectId: number) {
    this.logger.log(`Finding all purchase orders for Project ID: ${projectId}`);
    return this.purchaseOrderService.findAllByProjectId(projectId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Finding purchase order with ID: ${id}`);
    return this.purchaseOrderService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updatePurchaseOrderDto: UpdatePurchaseOrderDto) {
    this.logger.log(`Updating purchase order with ID: ${id}`);
    return this.purchaseOrderService.update(id, updatePurchaseOrderDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Removing purchase order with ID: ${id}`);
    return this.purchaseOrderService.remove(id);
  }
}
