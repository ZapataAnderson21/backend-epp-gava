import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateUserUserTypeDto } from './dto/create-user_user_type.dto';
import { UpdateUserUserTypeDto } from './dto/update-user_user_type.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserUserType } from 'generated/prisma';

@Injectable()
export class UserUserTypeService {

  private readonly logger = new Logger('UserUserTypeService');

  constructor ( private readonly prismaService: PrismaService) {}

  async create(createUserUserTypeDto: CreateUserUserTypeDto) {
    this.logger.log(`Creating user_user_type: ${JSON.stringify(createUserUserTypeDto)}`);
    const userUserType = await this.prismaService.userUserType.create({
      data: createUserUserTypeDto,
    });

    if (!userUserType) {
      this.logger.error(`Failed to create user_user_type: ${JSON.stringify(createUserUserTypeDto)}`);
      throw new BadRequestException('Failed to create user_user_type');
    }

    this.logger.log(`user_user_type created successfully: ${JSON.stringify(userUserType)}`);
    return userUserType;
  }

  async findOne(id: number): Promise<UserUserType | null> {
    this.logger.log(`Finding user_user_type by ID: ${id}`);
    const userUserType = await this.prismaService.userUserType.findUnique({
      where: { user_user_type_id: id },
    });

    if (!userUserType) {
      this.logger.warn(`user_user_type not found: ${id}`);
      throw new NotFoundException('user_user_type not found');
    }

    this.logger.log(`user_user_type found: ${JSON.stringify(userUserType)}`);
    return userUserType;
  }

  async findByUserId(userId: number): Promise<UserUserType | null> {
    this.logger.log(`Finding user_user_type by user ID: ${userId}`);
    const userUserType = await this.prismaService.userUserType.findUnique({
      where: { user_id: userId },
    });

    if (!userUserType) {
      this.logger.warn(`user_user_type not found: ${userId}`);
      throw new NotFoundException('user_user_type not found');
    }

    this.logger.log(`user_user_type found: ${JSON.stringify(userUserType)}`);
    return userUserType;
  }
}
