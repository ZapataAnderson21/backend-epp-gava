import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { UserUserTypeService } from './user_user_type.service';
import { CreateUserUserTypeDto } from './dto/create-user_user_type.dto';
import { UpdateUserUserTypeDto } from './dto/update-user_user_type.dto';

@Controller('user-user-type')
export class UserUserTypeController {
  constructor(private readonly userUserTypeService: UserUserTypeService) {}

  @Post()
  create(@Body() createUserUserTypeDto: CreateUserUserTypeDto) {
    return this.userUserTypeService.create(createUserUserTypeDto);
  }

  @Get()
  findAll() {
    return this.userUserTypeService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userUserTypeService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserUserTypeDto: UpdateUserUserTypeDto) {
    return this.userUserTypeService.update(+id, updateUserUserTypeDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userUserTypeService.remove(+id);
  }
}
