import { Controller, Get, Post, Body, Param, HttpStatus, Patch, ParseIntPipe } from '@nestjs/common';
import { RequestResponseService } from './request_response.service';
import { CreateRequestResponseDto } from './dto/create-request_response.dto';
import { ApiBody, ApiResponse } from '@nestjs/swagger';
import { UpdateRequestResponseDto } from './dto/update-request_response.dto';

@Controller('request-response')
export class RequestResponseController {
  constructor(private readonly requestResponseService: RequestResponseService) {}

  @ApiBody({ type: CreateRequestResponseDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Request response created successfully.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Failed to create request response.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Request response not found.' })
  @Post()
  async create(@Body() createRequestResponseDto: CreateRequestResponseDto) {
    return await this.requestResponseService.create(createRequestResponseDto);
  }

  @ApiResponse({ status: HttpStatus.OK, description: 'Request response retrieved successfully.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Request response not found.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error.' })
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.requestResponseService.findOne(id);
  }

  @ApiResponse({ status: HttpStatus.OK, description: 'Request responses retrieved successfully.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No request responses found.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error.' })
  @Get('request/:requestId')
  async findByRequestId(@Param('requestId', ParseIntPipe) requestId: number) {
    return await this.requestResponseService.findByRequestId(requestId);
  }

  @ApiResponse({ status: HttpStatus.OK, description: 'All request responses retrieved successfully.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No request responses found.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error.' })
  @Get()
  async findAll() {
    return await this.requestResponseService.findAll();
  }


  @ApiBody({ type: UpdateRequestResponseDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Request response updated successfully.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Request response not found.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error.' })
  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateRequestResponseDto: UpdateRequestResponseDto) {
    return await this.requestResponseService.update(id, updateRequestResponseDto);
  }

}
