import { Controller, Get, Post, Body, Patch, Param, Delete, Logger, ParseIntPipe, Query, Res } from '@nestjs/common';
import { PurchaseOrderService } from './purchase-order.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { Response } from 'express';
import { UserTypes } from 'src/decorators/user-types.decorator';
import { PdfService } from 'src/pdf/pdf.service';
import { createReadStream } from 'fs';

@Controller('purchase-order')
export class PurchaseOrderController {
  
  private readonly logger = new Logger('PurchaseOrderController');
  
  constructor(private readonly purchaseOrderService: PurchaseOrderService, 
              private readonly pdfService: PdfService) {}

  @Post()
  @UserTypes('GERENTE', 'ADMINISTRADORA')
  create(@Body() createPurchaseOrderDto: CreatePurchaseOrderDto) {
    this.logger.log(`Creating purchase order: ${JSON.stringify(createPurchaseOrderDto)}`);
    return this.purchaseOrderService.create(createPurchaseOrderDto);
  }

  @Get('project/:projectId')
  @UserTypes('GERENTE', 'ADMINISTRADORA', 'LOGISTICA')
  findAllByProjectId(@Param('projectId', ParseIntPipe) projectId: number) {
    this.logger.log(`Finding all purchase orders for Project ID: ${projectId}`);
    return this.purchaseOrderService.findAllByProjectId(projectId);
  }

  @Get(':id')
  @UserTypes('GERENTE', 'ADMINISTRADORA', 'LOGISTICA')
  findOne(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Finding purchase order with ID: ${id}`);
    return this.purchaseOrderService.findOne(id);
  }

  @Get('saleAmounts/:projectId')
  @UserTypes('GERENTE', 'ADMINISTRADORA', 'LOGISTICA')
  sumAllSaleAmounts(@Param('projectId', ParseIntPipe) projectId: number) {
    this.logger.log(`Summing all sale amounts for Project ID: ${projectId}`);
    return this.purchaseOrderService.sumAllSalesAmountsByProject(projectId);
  }

  @Get('purchaseAmounts/:projectId')
  @UserTypes('GERENTE', 'ADMINISTRADORA', 'LOGISTICA')
  sumAllPurchaseAmounts(@Param('projectId', ParseIntPipe) projectId: number) {
    this.logger.log(`Summing all purchase amounts for Project ID: ${projectId}`);
    return this.purchaseOrderService.sumAllPurchaseAmountsByProject(projectId);
  }

  @Get('pdf/:id')
  @UserTypes('GERENTE', 'ADMINISTRADORA', 'LOGISTICA')
  async generatePdf(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response
  ) {
    this.logger.log(`Generating PDF for purchase order with ID: ${id}`);
    const { outputPath, fileName } = await this.pdfService.generatePurchaseOrderPdf(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName || `orden-compra-${id}.pdf`}"`);
    return createReadStream(outputPath).pipe(res);
  }

  @Patch(':id')
  @UserTypes('GERENTE', 'ADMINISTRADORA')
  update(@Param('id', ParseIntPipe) id: number, @Body() updatePurchaseOrderDto: UpdatePurchaseOrderDto) {
    this.logger.log(`Updating purchase order with ID: ${id}`);
    return this.purchaseOrderService.update(id, updatePurchaseOrderDto);
  }

  @Delete(':id')
  @UserTypes('GERENTE', 'ADMINISTRADORA')
  remove(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Removing purchase order with ID: ${id}`);
    return this.purchaseOrderService.remove(id);
  }
}
