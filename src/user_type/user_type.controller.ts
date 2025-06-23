import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
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
  create(@Body() createUserTypeDto: CreateUserTypeDto) {
    
    return this.userTypeService.create(createUserTypeDto);
  }
}
