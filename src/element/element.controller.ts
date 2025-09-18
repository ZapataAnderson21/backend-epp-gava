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
    return await this.elementService.create(createElementDto);
      
  }

  @Public()
  @ApiResponse({ status: HttpStatus.OK, description: 'Elements retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No elements found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  @Get()
  async findAll() {
    return await this.elementService.findAll();
  }

  @Public()
  @ApiResponse({ status: HttpStatus.OK, description: 'Element retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Element not found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  @Get(':id')
  async findOne(@Param('id') id: number) {
    return await this.elementService.findOne(id);
  }

  @Public()
  @ApiResponse({ status: HttpStatus.OK, description: 'Elements by type retrieved successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid type specified' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No elements found for the specified type' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  @Get('type/:type')
  async findAllByType(@Param('type') type: string) {
    return await this.elementService.findAllByType(type);
  }

  @Public()
  @ApiBody({ type: UpdateElementDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Element updated successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Element not found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateElementDto: UpdateElementDto) {
    return await this.elementService.update(+id, updateElementDto);
  }
}
