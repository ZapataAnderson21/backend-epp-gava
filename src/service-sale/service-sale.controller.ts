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
import { ServiceSaleService } from './service-sale.service';
import { CreateServiceSaleDto } from './dto/create-service-sale.dto';
import { UpdateServiceSaleDto } from './dto/update-service-sale.dto';

@Controller('service-sale')
export class ServiceSaleController {
  private readonly logger = new Logger('ServiceSaleController');

  constructor(private readonly serviceSaleService: ServiceSaleService) {}

  @Post()
  create(@Body() createServiceSaleDto: CreateServiceSaleDto) {
    this.logger.log(
      `Creating service sale: ${JSON.stringify(createServiceSaleDto)}`,
    );
    return this.serviceSaleService.create(createServiceSaleDto);
  }

  @Get('project/:projectId')
  findAll(@Param('projectId', ParseIntPipe) projectId: number) {
    this.logger.log(`Fetching all service sales for project ID: ${projectId}`);
    return this.serviceSaleService.findAllByProject(projectId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Finding service sale with ID: ${id}`);
    return this.serviceSaleService.findOne(id);
  }

  @Get('sum/:projectId')
  sumAllAmounts(@Param('projectId', ParseIntPipe) projectId: number) {
    this.logger.log(
      `Calculating total amount of all service sales for project ID: ${projectId}`,
    );
    return this.serviceSaleService.sumAllAmountsByProject(projectId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateServiceSaleDto: UpdateServiceSaleDto,
  ) {
    this.logger.log(`Updating service sale with ID: ${id}`);
    return this.serviceSaleService.update(id, updateServiceSaleDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Removing service sale with ID: ${id}`);
    return this.serviceSaleService.remove(id);
  }
}
