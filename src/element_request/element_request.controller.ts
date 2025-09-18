import { Controller, Get, Post, Body, Patch, Param, Delete, HttpException, HttpStatus } from '@nestjs/common';
import { ElementRequestService } from './element_request.service';
import { CreateElementRequestDto } from './dto/create-element_request.dto';
import { UpdateElementRequestDto } from './dto/update-element_request.dto';
import { Public } from 'src/user/jwt/public.decorator';
import { ApiBody, ApiResponse } from '@nestjs/swagger';

@Controller('element-request')
export class ElementRequestController {
  constructor(private readonly elementRequestService: ElementRequestService) {}
  @Public()
  @ApiBody({ type: CreateElementRequestDto })
  @ApiResponse({ status: 201, description: 'Element Request created successfully' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  @Post()
  async create(@Body() createElementRequestDto: CreateElementRequestDto) {
    return await this.elementRequestService.create(createElementRequestDto);
  }
  

  @Public()
  @ApiResponse({ status: HttpStatus.OK, description: 'Element Requests retrieved successfully for the specified request ID' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid request ID' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No Element Requests found for the specified request ID' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  @Get('request/:request_id')
  async findAllByRequestId(@Param('request_id') request_id: string) {
    return await this.elementRequestService.findAllByRequestId(+request_id);
  }

  @Public()
  @ApiBody({ type: UpdateElementRequestDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Element Request updated successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid Element Request ID' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Element Request not found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateElementRequestDto: UpdateElementRequestDto) {
    return await this.elementRequestService.update(+id, updateElementRequestDto);
  }

  @Public()
  @ApiResponse({ status: HttpStatus.OK, description: 'Element Request removed successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid Element Request ID' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Element Request not found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.elementRequestService.remove(+id);
  }
}
