import { Injectable } from '@nestjs/common';
import { CreateUserTypeDto } from './dto/create-user_type.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserType, UserUserType } from 'generated/prisma';

@Injectable()
export class UserTypeService {

  constructor(private readonly prismaService: PrismaService) {}

  async create(createUserTypeDto: CreateUserTypeDto): Promise<UserType> {

    const existingUserType = await this.prismaService.userType.findUnique({
      where: { name : createUserTypeDto.name }
    });

    if (existingUserType) {
      throw new Error('User type already exists');
    }

    const newUserType = await this.prismaService.userType.create({
      data: createUserTypeDto
    });

    return newUserType;
  }

  async findOne(id: number): Promise<UserType | null> {

    const userType = await this.prismaService.userType.findUnique({
      where: { user_type_id: id }
    });

    return userType;
  }

}
