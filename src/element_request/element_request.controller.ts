import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ElementRequestService } from './element_request.service';
import { CreateElementRequestDto } from './dto/create-element_request.dto';
import { UpdateElementRequestDto } from './dto/update-element_request.dto';

@Controller('element-request')
export class ElementRequestController {
  constructor(private readonly elementRequestService: ElementRequestService) {}

  @Post()
  create(@Body() createElementRequestDto: CreateElementRequestDto) {
    return this.elementRequestService.create(createElementRequestDto);
  }

  @Get()
  findAll() {
    return this.elementRequestService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.elementRequestService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateElementRequestDto: UpdateElementRequestDto) {
    return this.elementRequestService.update(+id, updateElementRequestDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.elementRequestService.remove(+id);
  }
}
