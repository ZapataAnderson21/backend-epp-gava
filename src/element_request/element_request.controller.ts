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
    
    try {
      const newElementRequest = await this.elementRequestService.create(createElementRequestDto);
    
      if (!newElementRequest) {
        throw new HttpException('Failed to create Element Request', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      
      return {
        statusCode: HttpStatus.CREATED,
        message: 'Element Request created successfully',
        data: newElementRequest,
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'An error occurred while creating the Element Request',
        error: error.message || 'Internal Server Error',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  

  @Public()
  @ApiResponse({ status: HttpStatus.OK, description: 'Element Requests retrieved successfully for the specified request ID' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid request ID' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No Element Requests found for the specified request ID' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  @Get('request/:request_id')
  async findAllByRequestId(@Param('request_id') request_id: string) {
    try {
      if (isNaN(+request_id)) {
        throw new HttpException('Invalid request ID', HttpStatus.BAD_REQUEST);
      }

      const elementRequests = await this.elementRequestService.findAllByRequestId(+request_id);

      if (!elementRequests || elementRequests.length === 0) {
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'No Element Requests found for the specified request ID',
          data: [],
        };
      }

      return {
        statusCode: HttpStatus.OK,
        message: 'Element Requests retrieved successfully',
        data: elementRequests,
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'An error occurred while retrieving Element Requests',
        error: error.message || 'Internal Server Error',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Public()
  @ApiBody({ type: UpdateElementRequestDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Element Request updated successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid Element Request ID' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Element Request not found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateElementRequestDto: UpdateElementRequestDto) {
    try {
      if (isNaN(+id)) {
        throw new HttpException('Invalid Element Request ID', HttpStatus.BAD_REQUEST);
      }

      const updatedElementRequest = this.elementRequestService.update(+id, updateElementRequestDto);

      if (!updatedElementRequest) {
        throw new HttpException('Element Request not found', HttpStatus.NOT_FOUND);
      }

      return {
        statusCode: HttpStatus.OK,
        message: 'Element Request updated successfully',
        data: updatedElementRequest,
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'An error occurred while updating the Element Request',
        error: error.message || 'Internal Server Error',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Public()
  @ApiResponse({ status: HttpStatus.OK, description: 'Element Request removed successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid Element Request ID' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Element Request not found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    try {
      if (isNaN(+id)) {
        throw new HttpException('Invalid Element Request ID', HttpStatus.BAD_REQUEST);
      }

      const deletedElementRequest = this.elementRequestService.remove(+id);

      if (!deletedElementRequest) {
        throw new HttpException('Element Request not found', HttpStatus.NOT_FOUND);
      }

      return {
        statusCode: HttpStatus.OK,
        message: 'Element Request removed successfully',
        data: deletedElementRequest,
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'An error occurred while removing the Element Request',
        error: error.message || 'Internal Server Error',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
