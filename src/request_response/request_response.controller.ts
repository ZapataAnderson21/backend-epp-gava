import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  ParseIntPipe,
} from '@nestjs/common';
import { RequestResponseService } from './request_response.service';
import { CreateRequestResponseDto } from './dto/create-request_response.dto';
import { UpdateRequestResponseDto } from './dto/update-request-response.dto';
import { GetUser } from 'src/decorators/get-user.decorator';

@Controller('request-response')
export class RequestResponseController {
  constructor(
    private readonly requestResponseService: RequestResponseService,
  ) {}

  @Post()
  async create(
    @Body() createRequestResponseDto: CreateRequestResponseDto,
    @GetUser('userId') userId: number,
  ) {
    return await this.requestResponseService.create(
      createRequestResponseDto,
      userId,
    );
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @GetUser('userId') userId: number,
  ) {
    return await this.requestResponseService.findOne(id, userId);
  }

  @Get('request/:requestId')
  async findByRequestId(
    @Param('requestId', ParseIntPipe) requestId: number,
    @GetUser('userId') userId: number,
  ) {
    return await this.requestResponseService.findByRequestId(requestId, userId);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRequestResponseDto: UpdateRequestResponseDto,
    @GetUser('userId') userId: number,
  ) {
    return await this.requestResponseService.update(
      id,
      updateRequestResponseDto,
      userId,
    );
  }
}
