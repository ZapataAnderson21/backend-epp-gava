import { Controller, Get, Post, Body, Patch, Param, Delete, HttpStatus } from '@nestjs/common';
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
    try {
      const elementRequestResponse = await this.elementRequestResponseService.create(createElementRequestResponseDto);
      if (!elementRequestResponse) {
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Failed to create element request response',
          data: null,
        };
      }
      return {
        statusCode: HttpStatus.CREATED,
        message: 'Element request response created successfully',
        data: elementRequestResponse,
      };
    } catch (error) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        data: null,
      };
    }
  }

  @ApiResponse({ status: HttpStatus.OK, description: 'Element request responses retrieved successfully.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Element request responses not found.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error.' })
  @Get('request-response/:requestResponseId')
  async findByRequestResponseId(@Param('requestResponseId') requestResponseId: string) {
    try {
      const elementRequestResponse = await this.elementRequestResponseService.findByRequestResponseId(+requestResponseId);
      if (!elementRequestResponse || elementRequestResponse.length === 0) {
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Element request response not found',
          data: [],
        };
      }
      return {
        statusCode: HttpStatus.OK,
        message: 'Element request response retrieved successfully',
        data: elementRequestResponse,
      };
    } catch (error) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        data: null,
      };
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const elementRequestResponse = await this.elementRequestResponseService.findOne(+id);
      if (!elementRequestResponse) {
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Element request response not found',
          data: null,
        };
      }
      return {
        statusCode: HttpStatus.OK,
        message: 'Element request response retrieved successfully',
        data: elementRequestResponse,
      };
    } catch (error) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        data: null,
      };
    }
  }

}
