import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { ElementRequestService } from './element_request.service';
import { CreateElementRequestDto } from './dto/create-element_request.dto';
import { UpdateElementRequestDto } from './dto/update-element_request.dto';
import { GetUser } from 'src/decorators/get-user.decorator';

@Controller('element-request')
export class ElementRequestController {
  constructor(private readonly elementRequestService: ElementRequestService) {}
  @Post()
  async create(
    @Body() createElementRequestDto: CreateElementRequestDto,
    @GetUser('userId') userId: number,
  ) {
    return await this.elementRequestService.create(
      createElementRequestDto,
      userId,
    );
  }

  @Get(':id')
  async findAll(
    @Param('id', ParseIntPipe) id: number,
    @GetUser('userId') userId: number,
  ) {
    return await this.elementRequestService.findOne(id, userId);
  }

  @Get('request/:request_id')
  async findAllByRequestId(
    @Param('request_id', ParseIntPipe) request_id: number,
    @GetUser('userId') userId: number,
  ) {
    return await this.elementRequestService.findAllByRequestId(
      request_id,
      userId,
    );
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateElementRequestDto: UpdateElementRequestDto,
    @GetUser('userId') userId: number,
  ) {
    return await this.elementRequestService.update(
      id,
      updateElementRequestDto,
      userId,
    );
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @GetUser('userId') userId: number,
  ) {
    return await this.elementRequestService.remove(id, userId);
  }
}
