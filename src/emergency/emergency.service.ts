import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateEmergencyDto } from './dto/create-emergency.dto';
import { UpdateEmergencyDto } from './dto/update-emergency.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class EmergencyService {

  private readonly logger = new Logger("EmergencyService");

  constructor(private readonly prismaService: PrismaService) {}

  async create(createEmergencyDto: CreateEmergencyDto) {
    this.logger.log(`Creating emergency with data: ${JSON.stringify(createEmergencyDto)}`);
    const emergency = await this.prismaService.emergency.create({
      data: createEmergencyDto
    });

    if (!emergency) {
      this.logger.error('Failed to create emergency');
      throw new BadRequestException('Failed to create emergency');
    }

    this.logger.log(`Emergency created successfully: ${JSON.stringify(emergency)}`);
    return await this.findOne(emergency.emergency_id);
  }

  async findAll() {
    this.logger.log('Fetching all emergencies');
    const emergencies = await this.prismaService.emergency.findMany({
      include: {
        project: true,
        user: {
          include: {
            userUserTypes: {
              include: {
                userType: true
              }
            }
          }
        },
      },
    });

    if (!emergencies || emergencies.length === 0) {
      this.logger.warn('No emergencies found');
      return [];
    }

    const returnEmergencies = emergencies.map(emergency => {
      const returnUser = {
        user_id: emergency.user.user_id,
        name: emergency.user.name,
        last_name: emergency.user.last_name,
        email: emergency.user.email,
        userType: emergency.user.userUserTypes[0]?.userType?.name || null,
      };
      return { ...emergency, user: returnUser };
    });

    this.logger.log(`Found ${emergencies.length} emergencies`);
    return returnEmergencies;
  }

  async findOne(id: number) {
    this.logger.log(`Fetching emergency with ID: ${id}`);
    const emergency = await this.prismaService.emergency.findUnique({
      where: { emergency_id: id },
      include: {
        project: true,
        user: {
          include: {
            userUserTypes: {
              include: {
                userType: true
              }
            }
          },
        },
      },
    });

    if (!emergency) {
      this.logger.error(`Emergency with ID ${id} not found`);
      throw new NotFoundException(`Emergency with ID ${id} not found`);
    }

    const returnUser = {
      user_id: emergency.user.user_id,
      name: emergency.user.name,
      last_name: emergency.user.last_name,
      email: emergency.user.email,
      userType: emergency.user.userUserTypes[0].userType.name,
    }

    const returnEmergency = { ...emergency, user: returnUser };

    this.logger.log(`Emergency found: ${JSON.stringify(returnEmergency)}`);
    return returnEmergency;
  }

  async update(id: number, updateEmergencyDto: UpdateEmergencyDto) {
    this.logger.log(`Updating emergency with ID: ${id}`);
    const emergency = await this.prismaService.emergency.update({
      where: { emergency_id: id },
      data: updateEmergencyDto,
    });

    if (!emergency) {
      this.logger.warn(`Emergency with ID ${id} not found`);
      throw new NotFoundException(`Emergency with ID ${id} not found`);
    }

    this.logger.log(`Emergency updated successfully: ${JSON.stringify(emergency)}`);
    return await this.findOne(id);
  }

  async getAllByProjectId(project_id: number) {
    this.logger.log(`Fetching all emergencies for project ID: ${project_id}`);
    const emergencies = await this.prismaService.emergency.findMany({
      where: { project_id },
      include: {
        user: {
          include: {
            userUserTypes: {
              include: {
                userType: true
              }
            }
          }
        }
      }
    });

    if (!emergencies || emergencies.length === 0) {
      this.logger.warn(`No emergencies found for project ID ${project_id}`);
      return [];
    }

    const returnEmergencies = emergencies.map(emergency => {
      const returnUser = {
        user_id: emergency.user.user_id,
        name: emergency.user.name,
        last_name: emergency.user.last_name,
        email: emergency.user.email,
        userType: emergency.user.userUserTypes[0]?.userType?.name || null,
      };
      return { ...emergency, user: returnUser };
    });

    this.logger.log(`Found ${emergencies.length} emergencies for project ID ${project_id}`);
    return returnEmergencies;
  }

  async getAllByUserId(user_id: number) {
    this.logger.log(`Fetching all emergencies for user ID: ${user_id}`);
    const emergencies = await this.prismaService.emergency.findMany({
      where: { user_id },
      include: {
        project: true,
        user: {
          include: {
            userUserTypes: {
              include: {
                userType: true
              }
            }
          }
        }
      }
    });

    if (!emergencies || emergencies.length === 0) {
      this.logger.warn(`No emergencies found for user ID ${user_id}`);
      return [];
    }

    const returnEmergencies = emergencies.map(emergency => {
      const returnUser = {
        user_id: emergency.user.user_id,
        name: emergency.user.name,
        last_name: emergency.user.last_name,
        email: emergency.user.email,
        userType: emergency.user.userUserTypes[0]?.userType?.name || null,
      };
      return { ...emergency, user: returnUser };
    });

    this.logger.log(`Found ${emergencies.length} emergencies for user ID ${user_id}`);
    return returnEmergencies;
  }
}
