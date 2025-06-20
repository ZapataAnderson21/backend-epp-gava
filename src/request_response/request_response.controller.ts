import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { RequestResponseService } from './request_response.service';
import { CreateRequestResponseDto } from './dto/create-request_response.dto';
import { UpdateRequestResponseDto } from './dto/update-request_response.dto';

@Controller('request-response')
export class RequestResponseController {
  constructor(private readonly requestResponseService: RequestResponseService) {}

  @Post()
  create(@Body() createRequestResponseDto: CreateRequestResponseDto) {
    return this.requestResponseService.create(createRequestResponseDto);
  }

  @Get()
  findAll() {
    return this.requestResponseService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.requestResponseService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRequestResponseDto: UpdateRequestResponseDto) {
    return this.requestResponseService.update(+id, updateRequestResponseDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.requestResponseService.remove(+id);
  }
}
