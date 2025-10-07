import { Controller, Get, Post, Body, Patch, Param, Delete, HttpStatus, ParseIntPipe, Logger } from '@nestjs/common';
import { ElementRequestResponseService } from './element_request_response.service';
import { CreateElementRequestResponseDto } from './dto/create-element_request_response.dto';
import { UpdateElementRequestResponseDto } from './dto/update-element_request_response.dto';
import { ApiBody, ApiResponse } from '@nestjs/swagger';

@Controller('element-request-response')
export class ElementRequestResponseController {

  private readonly logger = new Logger("ElementRequestResponseController");

  constructor(private readonly elementRequestResponseService: ElementRequestResponseService) {}

  @Post()
  async create(@Body() createElementRequestResponseDto: CreateElementRequestResponseDto) {
    this.logger.log(`Received request to create ElementRequestResponse: ${JSON.stringify(createElementRequestResponseDto)}`);
    return await this.elementRequestResponseService.create(createElementRequestResponseDto);
  }

  @Get('request-response/:requestResponseId')
  async findByRequestResponseId(@Param('requestResponseId', ParseIntPipe) requestResponseId: number) {
    this.logger.log(`Received request to find ElementRequestResponses by requestResponseId: ${requestResponseId}`);
    return await this.elementRequestResponseService.findByRequestResponseId(requestResponseId);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Received request to find ElementRequestResponse by id: ${id}`);
    return await this.elementRequestResponseService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateElementRequestResponseDto: UpdateElementRequestResponseDto) {
    this.logger.log(`Received request to update ElementRequestResponse id: ${id} with data: ${JSON.stringify(updateElementRequestResponseDto)}`);
    return await this.elementRequestResponseService.update(id, updateElementRequestResponseDto);
  }
}
