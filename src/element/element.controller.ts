import { Controller, Get, Post, Body, Patch, Param, Delete, HttpException, HttpStatus } from '@nestjs/common';
import { ElementService } from './element.service';
import { CreateElementDto } from './dto/create-element.dto';
import { UpdateElementDto } from './dto/update-element.dto';
import { Public } from 'src/user/jwt/public.decorator';
import { ApiBody, ApiResponse } from '@nestjs/swagger';

@Controller('element')
export class ElementController {
  constructor(private readonly elementService: ElementService) {}

  @Public()
  @ApiBody({ type: CreateElementDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Element created successfully' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  @Post()
  async create(@Body() createElementDto: CreateElementDto) {
    try {
      const newElement = await this.elementService.create(createElementDto);
      
      if (!newElement) {
        throw new HttpException('Failed to create Element', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      return {
        statusCode: HttpStatus.CREATED,
        message: 'Element created successfully',
        data: newElement,
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'An error occurred while creating the Element',
        error: error.message || 'Internal Server Error',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Public()
  @ApiResponse({ status: HttpStatus.OK, description: 'Elements retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No elements found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  @Get()
  async findAll() {
    try {
      const elements = await this.elementService.findAll();

      if (!elements || elements.length === 0) {
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'No elements found',
          data: [],
        };
      }

      return {
        statusCode: HttpStatus.OK,
        message: 'Elements retrieved successfully',
        data: elements,
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'An error occurred while retrieving elements',
        error: error.message || 'Internal Server Error',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Public()
  @ApiResponse({ status: HttpStatus.OK, description: 'Element retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Element not found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const element = await this.elementService.findOne(+id);

      if (!element) {
        throw new HttpException('Element not found', HttpStatus.NOT_FOUND);
      }

      return {
        statusCode: HttpStatus.OK,
        message: 'Element retrieved successfully',
        data: element,
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'An error occurred while retrieving the element',
        error: error.message || 'Internal Server Error',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Public()
  @ApiResponse({ status: HttpStatus.OK, description: 'Elements by type retrieved successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid type specified' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No elements found for the specified type' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  @Get('type/:type')
  async findAllByType(@Param('type') type: string) {
    try {

      if (type !== 'operative' && type !== 'security') {
        throw new HttpException('Invalid type specified', HttpStatus.BAD_REQUEST);
      }

      const elements = await this.elementService.findAllByType(type);

      if (!elements || elements.length === 0) {
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: `No elements found for type: ${type}`,
          data: [],
        };
      }

      return {
        statusCode: HttpStatus.OK,
        message: 'Elements by type retrieved successfully',
        data: elements,
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'An error occurred while retrieving elements by type',
        error: error.message || 'Internal Server Error',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Public()
  @ApiBody({ type: UpdateElementDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Element updated successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Element not found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateElementDto: UpdateElementDto) {
    try {
      const updatedElement = await this.elementService.update(+id, updateElementDto);

      if (!updatedElement) {
        throw new HttpException('Element not found', HttpStatus.NOT_FOUND);
      }

      return {
        statusCode: HttpStatus.OK,
        message: 'Element updated successfully',
        data: updatedElement,
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'An error occurred while updating the element',
        error: error.message || 'Internal Server Error',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
