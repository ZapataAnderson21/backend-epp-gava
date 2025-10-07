import { Controller, Get, Post, Body, Patch, Param, Delete, HttpException, HttpStatus } from '@nestjs/common';
import { ElementRequestService } from './element_request.service';
import { CreateElementRequestDto } from './dto/create-element_request.dto';
import { UpdateElementRequestDto } from './dto/update-element_request.dto';
import { Public } from 'src/user/jwt/public.decorator';
import { ApiBody, ApiResponse } from '@nestjs/swagger';

@Controller('element-request')
export class ElementRequestController {
  constructor(private readonly elementRequestService: ElementRequestService) {}
  @Post()
  async create(@Body() createElementRequestDto: CreateElementRequestDto) {
    return await this.elementRequestService.create(createElementRequestDto);
  }
  
  @Get('request/:request_id')
  async findAllByRequestId(@Param('request_id') request_id: string) {
    return await this.elementRequestService.findAllByRequestId(+request_id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateElementRequestDto: UpdateElementRequestDto) {
    return await this.elementRequestService.update(+id, updateElementRequestDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.elementRequestService.remove(+id);
  }
}
