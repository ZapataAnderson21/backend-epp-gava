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
  Res,
  Query,
} from '@nestjs/common';
import { Response } from 'express';
import { ResourceService } from './resource.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { ExcelService } from 'src/excel/excel.service';
import { SearchPaginationQueryDto } from 'src/common/pagination';

@Controller('resource')
export class ResourceController {
  private readonly logger = new Logger('ResourceController');

  constructor(
    private readonly resourceService: ResourceService,
    private readonly excelService: ExcelService,
  ) {}

  @Post()
  create(@Body() createResourceDto: CreateResourceDto) {
    this.logger.log(`Creating resource: ${JSON.stringify(createResourceDto)}`);
    return this.resourceService.create(createResourceDto);
  }

  @Get()
  findAll() {
    this.logger.log(`Finding all resources`);
    return this.resourceService.findAll();
  }

  @Get('paginated')
  findPaginated(@Query() query: SearchPaginationQueryDto) {
    return this.resourceService.findPaginated(query);
  }

  @Get('export/excel')
  async downloadExcel(@Res() res: Response) {
    this.logger.log('Exporting purchase order resources to Excel');
    const buffer = await this.excelService.generateResourcesExcel();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=recursos_ordenes_compra.xlsx',
    );
    res.send(buffer);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    this.logger.log(`Finding resource with ID: ${id}`);
    return this.resourceService.findOne(+id);
  }

  @Get('category/:id')
  findByCategoryResourceId(
    @Param('id', ParseIntPipe) categoryResourceId: number,
  ) {
    this.logger.log(
      `Finding resources for categoryResourceId: ${categoryResourceId}`,
    );
    return this.resourceService.findByCategoryResourceId(categoryResourceId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateResourceDto: UpdateResourceDto,
  ) {
    this.logger.log(`Updating resource with ID: ${id}`);
    return this.resourceService.update(+id, updateResourceDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    this.logger.log(`Removing resource with ID: ${id}`);
    return this.resourceService.remove(+id);
  }
}
