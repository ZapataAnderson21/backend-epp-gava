import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Logger,
  ParseIntPipe,
} from '@nestjs/common';
import { ResourcePurchaseOrderService } from './resource-purchase-order.service';
import { CreateResourcePurchaseOrderDto } from './dto/create-resource-purchase-order.dto';
import { UpdateResourcePurchaseOrderDto } from './dto/update-resource-purchase-order.dto';

@Controller('resource-purchase-order')
export class ResourcePurchaseOrderController {
  private readonly logger = new Logger('ResourcePurchaseOrderController');

  constructor(
    private readonly resourcePurchaseOrderService: ResourcePurchaseOrderService,
  ) {}

  @Post()
  create(
    @Body() createResourcePurchaseOrderDto: CreateResourcePurchaseOrderDto,
  ) {
    this.logger.log(
      `Creating resource purchase order: ${JSON.stringify(createResourcePurchaseOrderDto)}`,
    );
    return this.resourcePurchaseOrderService.create(
      createResourcePurchaseOrderDto,
    );
  }

  @Get('purchase-order/:id')
  findAllByPurchaseOrderId(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(
      `Finding all resource purchase orders for Purchase Order ID: ${id}`,
    );
    return this.resourcePurchaseOrderService.findAllByPurchaseOrderId(id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Finding resource purchase order with ID: ${id}`);
    return this.resourcePurchaseOrderService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateResourcePurchaseOrderDto: UpdateResourcePurchaseOrderDto,
  ) {
    this.logger.log(`Updating resource purchase order with ID: ${id}`);
    return this.resourcePurchaseOrderService.update(
      id,
      updateResourcePurchaseOrderDto,
    );
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Removing resource purchase order with ID: ${id}`);
    return this.resourcePurchaseOrderService.remove(id);
  }
}
