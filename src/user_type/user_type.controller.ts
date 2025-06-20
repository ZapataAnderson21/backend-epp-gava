import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { UserTypeService } from './user_type.service';
import { CreateUserTypeDto } from './dto/create-user_type.dto';
import { UpdateUserTypeDto } from './dto/update-user_type.dto';

@Controller('user-type')
export class UserTypeController {
  constructor(private readonly userTypeService: UserTypeService) {}

  @Post()
  create(@Body() createUserTypeDto: CreateUserTypeDto) {
    return this.userTypeService.create(createUserTypeDto);
  }

  @Get()
  findAll() {
    return this.userTypeService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userTypeService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserTypeDto: UpdateUserTypeDto) {
    return this.userTypeService.update(+id, updateUserTypeDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userTypeService.remove(+id);
  }
}
