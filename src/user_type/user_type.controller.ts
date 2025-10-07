import { Controller, Get, Post, Body, Patch, Param, Delete, HttpException, HttpStatus, Logger, ParseIntPipe } from '@nestjs/common';
import { UserTypeService } from './user_type.service';
import { CreateUserTypeDto } from './dto/create-user_type.dto';
import { Public } from 'src/user/jwt/public.decorator';
import { ApiBody, ApiResponse } from '@nestjs/swagger';

@Controller('user-type')
export class UserTypeController {

  private readonly logger = new Logger('UserTypeController');

  constructor(private readonly userTypeService: UserTypeService) {}

  @Public()
  @Post()
  async create(@Body() createUserTypeDto: CreateUserTypeDto) {
    this.logger.log(`Creating user type: ${JSON.stringify(createUserTypeDto)}`);
    return await this.userTypeService.create(createUserTypeDto);
  }

  @Get()
  async findAll() {
    this.logger.log('Fetching all user types');
    return await this.userTypeService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Fetching user type with ID: ${id}`);
    return await this.userTypeService.findOne(id);
  }
}
