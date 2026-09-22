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
  Query,
  Res,
} from '@nestjs/common';
import { PurchaseOrderService } from './purchase-order.service';
import { CreateCompletePurchaseOrderDto } from './dto/create-complete-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { DuplicatePurchaseOrderDto } from './dto/duplicate-purchase-order.dto';
import { Response } from 'express';
import { UserTypes } from 'src/decorators/user-types.decorator';
import { PdfService } from 'src/pdf/pdf.service';
import { createReadStream } from 'fs';
import { ListPurchaseOrdersQueryDto } from './dto/list-purchase-orders-query.dto';
import { PurchaseOrderDashboardQueryDto } from './dto/purchase-order-dashboard-query.dto';
import { PurchaseOrderSummaryQueryDto } from './dto/purchase-order-summary-query.dto';
import { GetUser } from 'src/decorators/get-user.decorator';

@Controller('purchase-order')
export class PurchaseOrderController {
  private readonly logger = new Logger('PurchaseOrderController');

  constructor(
    private readonly purchaseOrderService: PurchaseOrderService,
    private readonly pdfService: PdfService,
  ) {}

  @Post(['', 'complete'])
  @UserTypes('GERENTE', 'ADMINISTRADORA', 'LOGISTICA')
  create(
    @Body() createPurchaseOrderDto: CreateCompletePurchaseOrderDto,
    @GetUser('userId') userId: number,
  ) {
    this.logger.log(
      `Creating purchase order: ${JSON.stringify(createPurchaseOrderDto)}`,
    );
    return this.purchaseOrderService.create(createPurchaseOrderDto, userId);
  }

  @Get('dashboard')
  @UserTypes('GERENTE', 'ADMINISTRADORA', 'LOGISTICA')
  findDashboard(@Query() query: PurchaseOrderDashboardQueryDto) {
    return this.purchaseOrderService.findDashboard(query);
  }

  @Get('directory')
  @UserTypes('GERENTE', 'ADMINISTRADORA', 'LOGISTICA')
  findDirectory() {
    return this.purchaseOrderService.findDirectory();
  }

  @Get('project/:projectId/unit-values')
  @UserTypes('GERENTE', 'ADMINISTRADORA', 'LOGISTICA')
  findUnitValuesByProject(@Param('projectId', ParseIntPipe) projectId: number) {
    this.logger.log(
      `Finding purchase order unit values for Project ID: ${projectId}`,
    );
    return this.purchaseOrderService.findUnitValuesByProject(projectId);
  }

  @Get('project/:projectId')
  @UserTypes('GERENTE', 'ADMINISTRADORA', 'LOGISTICA')
  findAllByProjectId(@Param('projectId', ParseIntPipe) projectId: number) {
    this.logger.log(`Finding all purchase orders for Project ID: ${projectId}`);
    return this.purchaseOrderService.findAllByProjectId(projectId);
  }

  @Get('project/:projectId/paginated')
  @UserTypes('GERENTE', 'ADMINISTRADORA', 'LOGISTICA')
  findPaginatedByProject(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: ListPurchaseOrdersQueryDto,
  ) {
    return this.purchaseOrderService.findPaginatedByProject(projectId, query);
  }

  @Get('project/:projectId/summary/pdf')
  @UserTypes('GERENTE', 'ADMINISTRADORA', 'LOGISTICA')
  async generateProjectSummaryPdf(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: PurchaseOrderSummaryQueryDto,
    @GetUser('email') generatedBy: string,
    @Res() res: Response,
  ) {
    const summary = await this.purchaseOrderService.findProjectSummary(
      projectId,
      query,
    );
    const { buffer, fileName } =
      await this.pdfService.generatePurchaseOrderSummaryPdf(
        summary.data,
        generatedBy,
      );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.send(buffer);
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
    this.logger.log(
      `Summing all purchase amounts for Project ID: ${projectId}`,
    );
    return this.purchaseOrderService.sumAllPurchaseAmountsByProject(projectId);
  }

  @Get('pdf/:id')
  @UserTypes('GERENTE', 'ADMINISTRADORA', 'LOGISTICA')
  async generatePdf(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    this.logger.log(`Generating PDF for purchase order with ID: ${id}`);
    const { outputPath, fileName } =
      await this.pdfService.generatePurchaseOrderPdf(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName || `orden-compra-${id}.pdf`}"`,
    );
    return createReadStream(outputPath).pipe(res);
  }

  @Patch(':id')
  @UserTypes('GERENTE', 'ADMINISTRADORA', 'LOGISTICA')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePurchaseOrderDto: UpdatePurchaseOrderDto,
  ) {
    this.logger.log(`Updating purchase order with ID: ${id}`);
    return this.purchaseOrderService.update(id, updatePurchaseOrderDto);
  }

  @Post(':id/duplicate')
  @UserTypes('GERENTE', 'ADMINISTRADORA', 'LOGISTICA')
  duplicate(
    @Param('id', ParseIntPipe) id: number,
    @Body() duplicatePurchaseOrderDto: DuplicatePurchaseOrderDto,
    @GetUser('userId') userId: number,
  ) {
    this.logger.log(
      `Duplicating purchase order with ID: ${id} to project: ${duplicatePurchaseOrderDto.projectId}`,
    );
    return this.purchaseOrderService.duplicate(
      id,
      duplicatePurchaseOrderDto.projectId,
      duplicatePurchaseOrderDto.creationKey,
      userId,
    );
  }

  @Delete(':id')
  @UserTypes('GERENTE', 'ADMINISTRADORA', 'LOGISTICA')
  remove(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Removing purchase order with ID: ${id}`);
    return this.purchaseOrderService.remove(id);
  }
}
