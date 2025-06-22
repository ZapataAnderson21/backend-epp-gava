import { Injectable } from '@nestjs/common';
import { CreateUserTypeDto } from './dto/create-user_type.dto';
import { UpdateUserTypeDto } from './dto/update-user_type.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserType } from 'generated/prisma';

@Injectable()
export class UserTypeService {

  constructor(private readonly prismaService: PrismaService) {}

  async create(createUserTypeDto: CreateUserTypeDto) {
    return this.prismaService.userType.create({ data: createUserTypeDto });
  }

  async findAll(): Promise<UserType[]> {
    return this.prismaService.userType.findMany();
  }

  async findOne(id: number): Promise<UserType | null> {
    return this.prismaService.userType.findUnique({ where: { user_type_id: id } });
  }

  async update(id: number, updateUserTypeDto: UpdateUserTypeDto) {
    return this.prismaService.userType.update({ where: { user_type_id: id }, data: updateUserTypeDto });
  }

  async remove(id: number) {
    return this.prismaService.userType.delete({ where: { user_type_id: id } });
  }
}
