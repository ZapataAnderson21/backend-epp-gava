import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { UserTypes } from 'src/decorators/user-types.decorator';
import { CreatePurchaseOrderConditionDto } from './dto/create-purchase-order-condition.dto';
import { FindPurchaseOrderConditionsQueryDto } from './dto/find-purchase-order-conditions-query.dto';
import { PurchaseOrderConditionService } from './purchase-order-condition.service';

@Controller('purchase-order-condition')
export class PurchaseOrderConditionController {
  constructor(
    private readonly purchaseOrderConditionService: PurchaseOrderConditionService,
  ) {}

  @Get()
  @UserTypes('GERENTE', 'ADMINISTRADORA', 'LOGISTICA')
  findAll(@Query() query: FindPurchaseOrderConditionsQueryDto) {
    return this.purchaseOrderConditionService.findAll(query);
  }

  @Post()
  @UserTypes('GERENTE', 'ADMINISTRADORA')
  create(@Body() dto: CreatePurchaseOrderConditionDto) {
    return this.purchaseOrderConditionService.create(dto);
  }
}
