import { Injectable } from '@nestjs/common';
import { CreateUserUserTypeDto } from './dto/create-user_user_type.dto';
import { UpdateUserUserTypeDto } from './dto/update-user_user_type.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserUserType } from 'generated/prisma';

@Injectable()
export class UserUserTypeService {

  constructor ( private readonly prismaService: PrismaService) {}

  async create(createUserUserTypeDto: CreateUserUserTypeDto) {
    const userUserType = await this.prismaService.userUserType.create({
      data: createUserUserTypeDto,
    });
    return userUserType;
  }

  async findOne(id: number): Promise<UserUserType | null> {
    const userUserType = await this.prismaService.userUserType.findUnique({
      where: { user_user_type_id: id },
    });

    return userUserType;
  }

  async findByUserId(userId: number): Promise<UserUserType | null> {
    const userUserType = await this.prismaService.userUserType.findUnique({
      where: { user_id: userId },
    });

    return userUserType;
  }
}
