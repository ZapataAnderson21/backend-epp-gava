import { Controller, Get, Post, Body, Patch, Param, Delete, HttpException, HttpStatus } from '@nestjs/common';
import { UserTypeService } from './user_type.service';
import { CreateUserTypeDto } from './dto/create-user_type.dto';
import { Public } from 'src/user/jwt/public.decorator';
import { ApiBody, ApiResponse } from '@nestjs/swagger';

@Controller('user-type')
export class UserTypeController {
  constructor(private readonly userTypeService: UserTypeService) {}

  @Public()
  @Post()
  @ApiBody({ type: CreateUserTypeDto })
  @ApiResponse({ status: 201, description: 'User type created successfully' })
  @ApiResponse({ status: 400, description: 'User type already exists' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async create(@Body() createUserTypeDto: CreateUserTypeDto) {
    return await this.userTypeService.create(createUserTypeDto);
  }

  @Get()
  @ApiResponse({ status: 200, description: 'User types retrieved successfully' })
  @ApiResponse({ status: 404, description: 'No user types found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async findAll() {
    return await this.userTypeService.findAll();
  }

  @Get(':id')
  @ApiResponse({ status: 200, description: 'User type found' })
  @ApiResponse({ status: 404, description: 'User type not found' })
  async findOne(@Param('id') id: string) {
    return await this.userTypeService.findOne(+id);
  }
}
