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

  @Get()
  findAll() {
    return this.elementRequestService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.elementRequestService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateElementRequestDto: UpdateElementRequestDto) {
    return this.elementRequestService.update(+id, updateElementRequestDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.elementRequestService.remove(+id);
  }
}
