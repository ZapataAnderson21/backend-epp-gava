import { Injectable } from '@nestjs/common';
import { CreateEmergencyDto } from './dto/create-emergency.dto';
import { UpdateEmergencyDto } from './dto/update-emergency.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class EmergencyService {

  constructor(private readonly prismaService: PrismaService) {}

  async create(createEmergencyDto: CreateEmergencyDto) {
    
    const emergency = await this.prismaService.emergency.create({
      data: createEmergencyDto,
    });

    if (!emergency) {
      return null;
    }

    return emergency;
  }

  async findAll() {
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
      return [];
    }

    return emergencies;
  }

  async findOne(id: number) {
    
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
      return null;
    }

    return emergency;
  }

  async update(id: number, updateEmergencyDto: UpdateEmergencyDto) {
    const emergency = await this.prismaService.emergency.update({
      where: { emergency_id: id },
      data: updateEmergencyDto,
    });

    if (!emergency) {
      return null;
    }

    return emergency;
  }

  async getAllByProjectId(project_id: number) {
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
      return [];
    }

    return emergencies;
  }

  async getAllByUserId(user_id: number) {
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
      return [];
    }

    return emergencies;
  }
}
