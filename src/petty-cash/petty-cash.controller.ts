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
  HttpException,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { Response } from 'express';
import { PettyCashService } from './petty-cash.service';
import { CreatePettyCashDto } from './dto/create-petty-cash.dto';
import { UpdatePettyCashDto } from './dto/update-petty-cash.dto';
import { PettyCashType } from './enum';
import { ExcelService } from 'src/excel/excel.service';
import { ListPettyCashesQueryDto } from './dto/list-petty-cashes-query.dto';

@Controller('petty-cash')
export class PettyCashController {
  private readonly logger = new Logger('PettyCashController');

  constructor(
    private readonly pettyCashService: PettyCashService,
    private readonly excelService: ExcelService,
  ) {}

  @Post()
  create(@Body() createPettyCashDto: CreatePettyCashDto) {
    this.logger.log(
      `Creating petty cash: ${JSON.stringify(createPettyCashDto)}`,
    );
    return this.pettyCashService.create(createPettyCashDto);
  }

  @Get('project/:projectId')
  findAllByProject(@Param('projectId', ParseIntPipe) projectId: number) {
    this.logger.log(
      `Fetching all petty cash entries for project ID: ${projectId}`,
    );
    return this.pettyCashService.findAllByProject(projectId);
  }

  @Get('project/:projectId/paginated')
  findPaginatedByProject(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: ListPettyCashesQueryDto,
  ) {
    return this.pettyCashService.findPaginatedByProject(projectId, query);
  }

  @Get('project/:projectId/excel')
  async downloadProjectExcel(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Res() res: Response,
  ) {
    try {
      this.logger.log(
        `Generating petty cash Excel for project ID: ${projectId}`,
      );
      const buffer = await this.excelService.generatePettyCashExcel(projectId);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=caja_chica_proyecto_${projectId}.xlsx`,
      );

      res.send(buffer);
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al generar el Excel',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Finding petty cash with ID: ${id}`);
    return this.pettyCashService.findOne(id);
  }

  @Get('sum/:projectId')
  sumAllAmounts(@Param('projectId', ParseIntPipe) projectId: number) {
    this.logger.log(
      `Calculating total amount of all petty cash entries for project ID: ${projectId}`,
    );
    return this.pettyCashService.sumAllAmountsByProject(projectId);
  }

  @Get('sum/:projectId/:pettyCashType')
  sumAmountsByTypeAndProject(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('pettyCashType') pettyCashType: PettyCashType,
  ) {
    this.logger.log(
      `Calculating total amount of petty cash entries for project ID: ${projectId} and type: ${pettyCashType}`,
    );
    return this.pettyCashService.sumAmountsByTypeAndProject(
      projectId,
      pettyCashType,
    );
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePettyCashDto: UpdatePettyCashDto,
  ) {
    this.logger.log(`Updating petty cash with ID: ${id}`);
    return this.pettyCashService.update(id, updatePettyCashDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Removing petty cash with ID: ${id}`);
    return this.pettyCashService.remove(id);
  }
}
