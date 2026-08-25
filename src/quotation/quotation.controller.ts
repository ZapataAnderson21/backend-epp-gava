import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { QuotationStatus } from './enum';
import { QuotationService } from './quotation.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { PdfService } from 'src/pdf/pdf.service';
import { Response } from 'express';
import { createReadStream } from 'fs';
import { ListQuotationsQueryDto } from './dto/list-quotations-query.dto';

@Controller('quotation')
export class QuotationController {
  private readonly logger = new Logger('QuotationController');

  constructor(
    private readonly quotationService: QuotationService,
    private readonly pdfService: PdfService,
  ) {}

  @Post()
  create(@Body() createQuotationDto: CreateQuotationDto) {
    this.logger.log(
      `Creating quotation: ${JSON.stringify(createQuotationDto)}`,
    );
    return this.quotationService.create(createQuotationDto);
  }

  @Get()
  findAll(
    @Query('clientId') clientId?: string,
    @Query('status') status?: QuotationStatus,
  ) {
    this.logger.log('Fetching all quotations');
    return this.quotationService.findAll({ clientId, status });
  }

  @Get('paginated')
  findPaginated(@Query() query: ListQuotationsQueryDto) {
    return this.quotationService.findPaginated(query);
  }

  @Get('pdf/:id')
  async generatePdf(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    this.logger.log(`Generating PDF for quotation with ID: ${id}`);
    const { outputPath, fileName } =
      await this.pdfService.generateQuotationPdf(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName || `cotizacion-${id}.pdf`}"`,
    );
    return createReadStream(outputPath).pipe(res);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Fetching quotation id=${id}`);
    return this.quotationService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateQuotationDto: UpdateQuotationDto,
  ) {
    this.logger.log(`Updating quotation id=${id}`);
    return this.quotationService.update(id, updateQuotationDto);
  }
}
