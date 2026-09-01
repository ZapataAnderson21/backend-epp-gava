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
import { RequestWorkerService } from './request-worker.service';
import { CreateRequestWorkerDto } from './dto/create-request-worker.dto';
import { UpdateRequestWorkerDto } from './dto/update-request-worker.dto';

@Controller('request-worker')
export class RequestWorkerController {
  private readonly logger = new Logger('RequestWorkerController');

  constructor(private readonly requestWorkerService: RequestWorkerService) {}

  @Post()
  create(@Body() createRequestWorkerDto: CreateRequestWorkerDto) {
    this.logger.log(
      `Creating Request Worker: ${JSON.stringify(createRequestWorkerDto)}`,
    );
    return this.requestWorkerService.create(createRequestWorkerDto);
  }

  @Get('request/:request_id')
  findAllByRequestId(@Param('request_id', ParseIntPipe) request_id: number) {
    this.logger.log(
      `Fetching all Request Workers for Request ID: ${request_id}`,
    );
    return this.requestWorkerService.findAllByRequestId(request_id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Fetching Request Worker with ID: ${id}`);
    return this.requestWorkerService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRequestWorkerDto: UpdateRequestWorkerDto,
  ) {
    this.logger.log(`Updating Request Worker with ID: ${id}`);
    return this.requestWorkerService.update(id, updateRequestWorkerDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Removing Request Worker with ID: ${id}`);
    return this.requestWorkerService.remove(id);
  }
}
