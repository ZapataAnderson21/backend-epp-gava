import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PdfService } from 'src/pdf/pdf.service';
import {
  AnnulDeliveryDto,
  CancelReturnDto,
  CreateDeliveryDto,
  CreateDispatchDto,
  CreateReturnDto,
  ListWorkClothingQueryDto,
  ReceiveDispatchDto,
} from './dto';
import { WorkClothingService } from './work-clothing.service';

type AuthenticatedRequest = Request & { user: { userId: number } };

@Controller('work-clothing')
export class WorkClothingController {
  constructor(
    private readonly service: WorkClothingService,
    private readonly pdfService: PdfService,
  ) {}

  @Get('stock')
  listCentralStock(@Query('search') search?: string) {
    return this.service.listCentralStock(search);
  }

  @Get('custodians')
  listCustodians(@Query('search') search?: string) {
    return this.service.listCustodians(search);
  }

  @Get('requests/:requestId/pending')
  getRequestFulfillment(@Param('requestId', ParseIntPipe) requestId: number) {
    return this.service.getRequestFulfillment(requestId);
  }

  @Get('dispatches')
  listDispatches(
    @Query() query: ListWorkClothingQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.listDispatches(query, req.user.userId);
  }

  @Post('dispatches')
  createDispatch(
    @Body() dto: CreateDispatchDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createDispatch(dto, req.user.userId);
  }

  @Post('dispatches/:id/receive')
  receiveDispatch(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReceiveDispatchDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.receiveDispatch(id, dto, req.user.userId);
  }

  @Get('custody')
  listCustody(
    @Query() query: ListWorkClothingQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.listCustody(query, req.user.userId);
  }

  @Get('deliveries')
  listDeliveries(@Query() query: ListWorkClothingQueryDto) {
    return this.service.listDeliveries(query);
  }

  @Get('deliveries/worker/:workerId')
  listWorkerDeliveries(
    @Param('workerId', ParseIntPipe) workerId: number,
    @Query() query: ListWorkClothingQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    query.workerId = workerId;
    return this.service.listWorkerDeliveries(query, req.user.userId);
  }

  @Post('deliveries')
  createDelivery(
    @Body() dto: CreateDeliveryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createDelivery(dto, req.user.userId);
  }

  @Patch('deliveries/:id/annul')
  annulDelivery(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AnnulDeliveryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.annulDelivery(id, dto, req.user.userId);
  }

  @Get('deliveries/:id/pdf')
  async deliveryPdf(
    @Param('id', ParseIntPipe) id: number,
    @Res() response: Response,
  ) {
    const { buffer, fileName } =
      await this.pdfService.generateWorkClothingDeliveryPdf(id);
    response.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': buffer.length,
    });
    response.end(buffer);
  }

  @Get('returns')
  listReturns(
    @Query() query: ListWorkClothingQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.listReturns(query, req.user.userId);
  }

  @Post('returns')
  createReturn(@Body() dto: CreateReturnDto, @Req() req: AuthenticatedRequest) {
    return this.service.createReturn(dto, req.user.userId);
  }

  @Post('returns/:id/confirm')
  confirmReturn(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.confirmReturn(id, req.user.userId);
  }

  @Post('returns/:id/cancel')
  cancelReturn(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelReturnDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.cancelReturn(id, dto, req.user.userId);
  }
}
