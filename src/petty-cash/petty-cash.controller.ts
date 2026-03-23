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
import { PettyCashService } from './petty-cash.service';
import { CreatePettyCashDto } from './dto/create-petty-cash.dto';
import { UpdatePettyCashDto } from './dto/update-petty-cash.dto';
import { PettyCashType } from './enum';

@Controller('petty-cash')
export class PettyCashController {
  private readonly logger = new Logger('PettyCashController');

  constructor(private readonly pettyCashService: PettyCashService) {}

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
