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
  @ApiResponse({ status: 201, description: 'Element created successfully' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  @Post()
  async create(@Body() createElementDto: CreateElementDto) {
    try {
      const newElement = await this.elementService.create(createElementDto);
      
      if (!newElement) {
        throw new HttpException('Failed to create Element', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      return {
        statusCode: 201,
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

  @Get()
  findAll() {
    return this.elementService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.elementService.findOne(+id);
  }

  @Get('type/:type')
  findByType(@Param('type') type: string) {
    return this.elementService.findByType(type);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateElementDto: UpdateElementDto) {
    return this.elementService.update(+id, updateElementDto);
  }
}
