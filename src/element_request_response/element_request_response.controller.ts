import { Controller, Get, Post, Body, Patch, Param, Delete, HttpStatus, ParseIntPipe } from '@nestjs/common';
import { ElementRequestResponseService } from './element_request_response.service';
import { CreateElementRequestResponseDto } from './dto/create-element_request_response.dto';
import { UpdateElementRequestResponseDto } from './dto/update-element_request_response.dto';
import { ApiBody, ApiResponse } from '@nestjs/swagger';

@Controller('element-request-response')
export class ElementRequestResponseController {
  constructor(private readonly elementRequestResponseService: ElementRequestResponseService) {}

  @ApiBody({ type: CreateElementRequestResponseDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Element request response created successfully.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Failed to create element request response.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error.' })
  @Post()
  async create(@Body() createElementRequestResponseDto: CreateElementRequestResponseDto) {
    return await this.elementRequestResponseService.create(createElementRequestResponseDto);
  }

  @ApiResponse({ status: HttpStatus.OK, description: 'Element request responses retrieved successfully.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Element request responses not found.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error.' })
  @Get('request-response/:requestResponseId')
  async findByRequestResponseId(@Param('requestResponseId', ParseIntPipe) requestResponseId: number) {
    return await this.elementRequestResponseService.findByRequestResponseId(requestResponseId);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.elementRequestResponseService.findOne(id);
  }

  @ApiBody({ type: UpdateElementRequestResponseDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Element request response updated successfully.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Element request response not found.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error.' })
  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateElementRequestResponseDto: UpdateElementRequestResponseDto) {
    return await this.elementRequestResponseService.update(id, updateElementRequestResponseDto);
  }
}
