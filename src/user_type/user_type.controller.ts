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
    
    try {
      const userTypeCreated = await this.userTypeService.create(createUserTypeDto);

      if (!userTypeCreated) {
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'User type already exists',
          data: null,
        };
      }

      return {
        statusCode: HttpStatus.CREATED,
        message: 'User type created successfully',
        data: userTypeCreated,
      }
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal Server Error',
        error: error.message || 'An unexpected error occurred',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get()
  @ApiResponse({ status: 200, description: 'User types retrieved successfully' })
  @ApiResponse({ status: 404, description: 'No user types found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async findAll() {
    try {
      const userTypes = await this.userTypeService.findAll();

      if (!userTypes || userTypes.length === 0) {
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'No user types found',
          data: [],
        };
      }

      return {
        statusCode: HttpStatus.OK,
        message: 'User types retrieved successfully',
        data: userTypes,
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal Server Error',
        error: error.message || 'An unexpected error occurred',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id')
  @ApiResponse({ status: 200, description: 'User type found' })
  @ApiResponse({ status: 404, description: 'User type not found' })
  async findOne(@Param('id') id: string) {
    try {
      const userType = await this.userTypeService.findOne(+id);

      if (!userType) {
        throw new HttpException({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'User type not found',
          error: 'Not Found',
        }, HttpStatus.NOT_FOUND);
      }

      return {
        statusCode: HttpStatus.OK,
        message: 'User type found',
        data: userType,
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal Server Error',
        error: error.message || 'An unexpected error occurred',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
