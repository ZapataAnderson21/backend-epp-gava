import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { UserUserTypeService } from './user_user_type.service';
import { CreateUserUserTypeDto } from './dto/create-user_user_type.dto';
import { UpdateUserUserTypeDto } from './dto/update-user_user_type.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('user-user-type')
export class UserUserTypeController {
  constructor(private readonly prismaService: PrismaService) {}

  @Post()
  async create(@Body() createUserUserTypeDto: CreateUserUserTypeDto) {
    return this.prismaService.userUserType.create({ data: createUserUserTypeDto });
  }

  @Get()
  async findAll() {
    return this.prismaService.userUserType.findMany();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.prismaService.userUserType.findUnique({ where: { user_user_type_id: Number(id) } });
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateUserUserTypeDto: UpdateUserUserTypeDto) {
    return this.prismaService.userUserType.update({
      where: { user_user_type_id: Number(id) },
      data: updateUserUserTypeDto,
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.prismaService.userUserType.delete({ where: { user_user_type_id: Number(id) } });
  }
}
