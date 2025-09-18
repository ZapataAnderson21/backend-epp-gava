import { Controller, Get, Post, Body, Patch, Param, Delete, HttpStatus } from '@nestjs/common';
import { RequestWorkerService } from './request-worker.service';
import { CreateRequestWorkerDto } from './dto/create-request-worker.dto';
import { UpdateRequestWorkerDto } from './dto/update-request-worker.dto';
import { ApiBody, ApiResponse } from '@nestjs/swagger';

@Controller('request-worker')
export class RequestWorkerController {
  constructor(private readonly requestWorkerService: RequestWorkerService) {}

  @ApiBody({ type: CreateRequestWorkerDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Request Worker created successfully' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Failed to create Request Worker' })
  @Post()
  create(@Body() createRequestWorkerDto: CreateRequestWorkerDto) {
    return this.requestWorkerService.create(createRequestWorkerDto);
  }

  @Get('request/:request_id')
  findAllByRequestId(@Param('request_id') request_id: string) {
    return this.requestWorkerService.findAllByRequestId(+request_id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.requestWorkerService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRequestWorkerDto: UpdateRequestWorkerDto) {
    return this.requestWorkerService.update(+id, updateRequestWorkerDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.requestWorkerService.remove(+id);
  }
}
