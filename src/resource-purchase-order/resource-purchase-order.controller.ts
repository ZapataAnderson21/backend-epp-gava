import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ResourcePurchaseOrderService } from './resource-purchase-order.service';
import { CreateResourcePurchaseOrderDto } from './dto/create-resource-purchase-order.dto';
import { UpdateResourcePurchaseOrderDto } from './dto/update-resource-purchase-order.dto';

@Controller('resource-purchase-order')
export class ResourcePurchaseOrderController {
  constructor(private readonly resourcePurchaseOrderService: ResourcePurchaseOrderService) {}

  @Post()
  create(@Body() createResourcePurchaseOrderDto: CreateResourcePurchaseOrderDto) {
    return this.resourcePurchaseOrderService.create(createResourcePurchaseOrderDto);
  }

  @Get()
  findAll() {
    return this.resourcePurchaseOrderService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.resourcePurchaseOrderService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateResourcePurchaseOrderDto: UpdateResourcePurchaseOrderDto) {
    return this.resourcePurchaseOrderService.update(+id, updateResourcePurchaseOrderDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.resourcePurchaseOrderService.remove(+id);
  }
}
