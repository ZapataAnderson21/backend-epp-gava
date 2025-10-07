import { Controller, Get, Post, Body, Param, Patch, ParseIntPipe } from '@nestjs/common';
import { RequestResponseService } from './request_response.service';
import { CreateRequestResponseDto } from './dto/create-request_response.dto';
import { UpdateRequestResponseDto } from './dto/update-request_response.dto';

@Controller('request-response')
export class RequestResponseController {
  constructor(private readonly requestResponseService: RequestResponseService) {}

  @Post()
  async create(@Body() createRequestResponseDto: CreateRequestResponseDto) {
    return await this.requestResponseService.create(createRequestResponseDto);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.requestResponseService.findOne(id);
  }

  @Get('request/:requestId')
  async findByRequestId(@Param('requestId', ParseIntPipe) requestId: number) {
    return await this.requestResponseService.findAllByRequestId(requestId);
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateRequestResponseDto: UpdateRequestResponseDto) {
    return await this.requestResponseService.update(id, updateRequestResponseDto);
  }

}
