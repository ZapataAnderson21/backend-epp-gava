import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateUserTypeDto } from './dto/create-user_type.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UserTypeService {

  private readonly logger = new Logger('UserTypeService');

  constructor(private readonly prismaService: PrismaService) {}

  async create(createUserTypeDto: CreateUserTypeDto) {

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

    this.logger.log(`User type created successfully: ${createUserTypeDto.name}`);  
    return {
      HttpStatus: HttpStatus.CREATED,
      message: 'El tipo de usuario ha sido registrado exitosamente.',
      data: newUserType
    };
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

  async findOne(userTypeId: number) {

    this.logger.log(`Finding user type by ID: ${userTypeId}`);
    const userType = await this.prismaService.userType.findUnique({
      where: { userTypeId }
    });

    if (!userType) {
      this.logger.warn(`User type not found: ${userTypeId}`);
      throw new NotFoundException('User type not found');
    }

    this.logger.log(`User type found: ${JSON.stringify(userType)}`);
    return {
      HttpStatus: HttpStatus.OK,
      message: 'Tipo de usuario encontrado.',
      data: userType
    };
  }

  async findAll() {

    this.logger.log('Finding all user types');
    const userTypes = await this.prismaService.userType.findMany();

    if (!userTypes || userTypes.length === 0) {
      this.logger.warn('No user types found');
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No se han encontrado tipos de usuario.',
        data: []
      };
    }

    this.logger.log(`Found ${userTypes.length} user types`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Tipos de usuario encontrados exitosamente.',
      data: userTypes
    };
  }

}
