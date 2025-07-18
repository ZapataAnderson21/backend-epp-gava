import { Controller, Get, Post, Body, Param, HttpStatus, Patch } from '@nestjs/common';
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
    try {
      console.log('Creating request response with data:', createRequestResponseDto);
      const requestResponse = await this.requestResponseService.create(createRequestResponseDto);
      if (!requestResponse) {
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Failed to create request response',
          data: null,
        };
      }
      return {
        statusCode: HttpStatus.CREATED,
        message: 'Request response created successfully',
        data: requestResponse,
      };
    } catch (error) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        data: null,
      };
    }
  }

  @ApiResponse({ status: HttpStatus.OK, description: 'Request response retrieved successfully.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Request response not found.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error.' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const requestResponse = await this.requestResponseService.findOne(+id);
      if (!requestResponse) {
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Request response not found',
          data: null,
        };
      }
      return {
        statusCode: HttpStatus.OK,
        message: 'Request response retrieved successfully',
        data: requestResponse,
      };
    } catch (error) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        data: null,
      };
    }
  }

  @ApiResponse({ status: HttpStatus.OK, description: 'Request responses retrieved successfully.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No request responses found.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error.' })
  @Get('request/:requestId')
  async findByRequestId(@Param('requestId') requestId: string) {
    try {
      const requestResponse = await this.requestResponseService.findByRequestId(+requestId);
      if (!requestResponse) {
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'No request responses found',
          data: null,
        };
      }
      return {
        statusCode: HttpStatus.OK,
        message: 'Request responses retrieved successfully',
        data: requestResponse,
      };
    } catch (error) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        data: null,
      };
    }
  }

  @ApiResponse({ status: HttpStatus.OK, description: 'All request responses retrieved successfully.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No request responses found.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error.' })
  @Get()
  async findAll() {
    try {
      const requestResponses = await this.requestResponseService.findAll();
      if (!requestResponses || requestResponses.length === 0) {
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'No request responses found',
          data: [],
        };
      }
      return {
        statusCode: HttpStatus.OK,
        message: 'Request responses retrieved successfully',
        data: requestResponses,
      };
    } catch (error) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        data: null,
      };
    }
  }


  @ApiBody({ type: UpdateRequestResponseDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Request response updated successfully.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Request response not found.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error.' })
  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateRequestResponseDto: UpdateRequestResponseDto) {
    try {
      const updatedRequestResponse = await this.requestResponseService.update(+id, updateRequestResponseDto);
      if (!updatedRequestResponse) {
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Request response not found',
          data: null,
        };
      }
      return {
        statusCode: HttpStatus.OK,
        message: 'Request response updated successfully',
        data: updatedRequestResponse,
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
