import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateUserTypeDto } from './dto/create-user_type.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserType, UserUserType } from 'generated/prisma';

@Injectable()
export class UserTypeService {

  private readonly logger = new Logger('UserTypeService');

  constructor(private readonly prismaService: PrismaService) {}

  async create(createUserTypeDto: CreateUserTypeDto): Promise<UserType> {

    this.logger.log(`Creating user type: ${JSON.stringify(createUserTypeDto)}`);

    await this.existingUserTypeByName(createUserTypeDto.name);

    this.logger.log('Proceeding to create');
    const newUserType = await this.prismaService.userType.create({
      data: createUserTypeDto
    });

    if (!newUserType) {
      this.logger.error(`Failed to create user type: ${JSON.stringify(createUserTypeDto)}`);
      throw new BadRequestException('Failed to create user type');
    }

    return newUserType;
  }

  async existingUserTypeByName(name: string) {
    this.logger.log('Checking if user type already exists');
    const existingUserTypes = await this.prismaService.userType.findMany({
      where: { name }
    });

    if (existingUserTypes.length > 0) {
      this.logger.error(`User type already exists: ${name}`);
      throw new ConflictException('User type already exists');
    }
  }

  async findOne(id: number) {

    this.logger.log(`Finding user type by ID: ${id}`);
    const userType = await this.prismaService.userType.findUnique({
      where: { user_type_id: id }
    });

    if (!userType) {
      this.logger.warn(`User type not found: ${id}`);
      throw new NotFoundException('User type not found');
    }

    this.logger.log(`User type found: ${JSON.stringify(userType)}`);
    return userType;
  }

  async findAll() {

    this.logger.log('Finding all user types');
    const userTypes = await this.prismaService.userType.findMany();

    if (!userTypes || userTypes.length === 0) {
      this.logger.warn('No user types found');
      return [];
    }

    this.logger.log(`Found ${userTypes.length} user types`);
    return userTypes;
  }

}
