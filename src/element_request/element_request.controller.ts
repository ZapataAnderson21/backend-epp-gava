import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpException,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { ElementRequestService } from './element_request.service';
import { CreateElementRequestDto } from './dto/create-element_request.dto';
import { UpdateElementRequestDto } from './dto/update-element_request.dto';

@Controller('element-request')
export class ElementRequestController {
  constructor(private readonly elementRequestService: ElementRequestService) {}
  @Post()
  async create(@Body() createElementRequestDto: CreateElementRequestDto) {
    return await this.elementRequestService.create(createElementRequestDto);
  }

  @Get(':id')
  async findAll(@Param('id', ParseIntPipe) id: number) {
    return await this.elementRequestService.findOne(id);
  }

  @Get('request/:request_id')
  async findAllByRequestId(
    @Param('request_id', ParseIntPipe) request_id: number,
  ) {
    return await this.elementRequestService.findAllByRequestId(request_id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateElementRequestDto: UpdateElementRequestDto,
  ) {
    return await this.elementRequestService.update(id, updateElementRequestDto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return await this.elementRequestService.remove(id);
  }
}
