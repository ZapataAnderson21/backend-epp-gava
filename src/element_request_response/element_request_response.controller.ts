import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ElementRequestResponseService } from './element_request_response.service';
import { CreateElementRequestResponseDto } from './dto/create-element_request_response.dto';
import { UpdateElementRequestResponseDto } from './dto/update-element_request_response.dto';

@Controller('element-request-response')
export class ElementRequestResponseController {
  constructor(private readonly elementRequestResponseService: ElementRequestResponseService) {}

  @Post()
  create(@Body() createElementRequestResponseDto: CreateElementRequestResponseDto) {
    return this.elementRequestResponseService.create(createElementRequestResponseDto);
  }

  @Get()
  findAll() {
    return this.elementRequestResponseService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.elementRequestResponseService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateElementRequestResponseDto: UpdateElementRequestResponseDto) {
    return this.elementRequestResponseService.update(+id, updateElementRequestResponseDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.elementRequestResponseService.remove(+id);
  }
}
