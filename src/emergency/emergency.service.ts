import {
  BadRequestException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateEmergencyDto } from './dto/create-emergency.dto';
import { UpdateEmergencyDto } from './dto/update-emergency.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationService } from 'src/notification/notification.service';
import { buildPaginatedData, getPaginationArgs } from 'src/common/pagination';
import { ListEmergenciesQueryDto } from './dto/list-emergencies-query.dto';

@Injectable()
export class EmergencyService {
  private readonly logger = new Logger('EmergencyService');

  constructor(
    private readonly prismaService: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(createEmergencyDto: CreateEmergencyDto) {
    this.logger.log(
      `Creating emergency with data: ${JSON.stringify(createEmergencyDto)}`,
    );
    const emergency = await this.prismaService.emergency.create({
      data: createEmergencyDto,
      include: {
        project: { select: { projectId: true, name: true } },
      },
    });

    if (!emergency) {
      this.logger.error('Failed to create emergency');
      throw new BadRequestException('Failed to create emergency');
    }

    // Notificar a GERENTE y ADMINISTRADORA sobre la nueva emergencia
    await this.notificationService.notifyEmergencyCreated(
      emergency.emergencyId,
      emergency.projectId,
      emergency.project.name,
      emergency.title,
    );

    this.logger.log(
      `Emergency created successfully: ${JSON.stringify(emergency)}`,
    );
    return {
      statusCode: HttpStatus.CREATED,
      data: emergency,
      message: 'Emergencia registrada exitosamente.',
    };
  }

  async findAll(projectId?: number, userId?: number) {
    this.logger.log('Fetching all emergencies');
    const emergencies = await this.prismaService.emergency.findMany({
      include: {
        project: true,
        user: {
          include: {
            userUserTypes: {
              include: {
                userType: true,
              },
            },
          },
        },
      },
      where: { projectId, userId },
    });

    if (!emergencies || emergencies.length === 0) {
      this.logger.warn('No emergencies found');
      return {
        statusCode: HttpStatus.NOT_FOUND,
        data: [],
        message: 'No se encontraron emergencias.',
      };
    }

    const returnEmergencies = emergencies.map((emergency) => {
      const returnUser = {
        userId: emergency.user.userId,
        name: emergency.user.name,
        lastName: emergency.user.lastName,
        email: emergency.user.email,
        userType: emergency.user.userUserTypes[0]?.userType?.name || null,
      };
      return { ...emergency, user: returnUser };
    });

    this.logger.log(`Found ${emergencies.length} emergencies`);
    return {
      statusCode: HttpStatus.OK,
      data: returnEmergencies,
      message: 'Emergencies retrieved successfully.',
    };
  }

  async findPaginated(query: ListEmergenciesQueryDto) {
    const search = query.search?.trim();
    const where = {
      projectId: query.projectId,
      userId: query.userId,
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              { description: { contains: search, mode: 'insensitive' as const } },
              { project: { name: { contains: search, mode: 'insensitive' as const } } },
              { user: { name: { contains: search, mode: 'insensitive' as const } } },
              { user: { lastName: { contains: search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };
    const { skip, take } = getPaginationArgs(query);
    const include = {
      project: true,
      user: { include: { userUserTypes: { include: { userType: true } } } },
    } as const;
    const [emergencies, totalItems] = await Promise.all([
      this.prismaService.emergency.findMany({
        where,
        include,
        orderBy: [{ createdAt: 'desc' }, { emergencyId: 'desc' }],
        skip,
        take,
      }),
      this.prismaService.emergency.count({ where }),
    ]);
    const items = emergencies.map((emergency) => ({
      ...emergency,
      user: {
        userId: emergency.user.userId,
        name: emergency.user.name,
        lastName: emergency.user.lastName,
        email: emergency.user.email,
        userType: emergency.user.userUserTypes[0]?.userType?.name || null,
      },
    }));

    return {
      statusCode: HttpStatus.OK,
      message: 'Emergencias obtenidas exitosamente.',
      data: buildPaginatedData(items, totalItems, query),
    };
  }

  async findOne(id: number) {
    this.logger.log(`Fetching emergency with ID: ${id}`);
    const emergency = await this.prismaService.emergency.findUnique({
      where: { emergencyId: id },
      include: {
        project: true,
        user: {
          include: {
            userUserTypes: {
              include: {
                userType: true,
              },
            },
          },
        },
      },
    });

    if (!emergency) {
      this.logger.error(`Emergency with ID ${id} not found`);
      throw new NotFoundException(`Emergency with ID ${id} not found`);
    }

    const returnUser = {
      userId: emergency.user.userId,
      name: emergency.user.name,
      lastName: emergency.user.lastName,
      email: emergency.user.email,
      userType: emergency.user.userUserTypes[0]?.userType?.name || null,
    };

    const returnEmergency = { ...emergency, user: returnUser };

    this.logger.log(`Emergency found: ${JSON.stringify(returnEmergency)}`);
    return {
      statusCode: HttpStatus.OK,
      data: returnEmergency,
      message: 'Emergency retrieved successfully.',
    };
  }

  async update(id: number, updateEmergencyDto: UpdateEmergencyDto) {
    this.logger.log(`Updating emergency with ID: ${id}`);

    // Obtener la emergencia antes de actualizar para comparar el estado
    const existingEmergency = await this.prismaService.emergency.findUnique({
      where: { emergencyId: id },
    });

    if (!existingEmergency) {
      this.logger.warn(`Emergency with ID ${id} not found`);
      throw new NotFoundException(`Emergency with ID ${id} not found`);
    }

    const previousStatus = existingEmergency.status;

    const emergency = await this.prismaService.emergency.update({
      where: { emergencyId: id },
      data: updateEmergencyDto,
    });

    // Notificar al creador si el estado cambió
    if (
      updateEmergencyDto.status &&
      updateEmergencyDto.status !== previousStatus
    ) {
      if (updateEmergencyDto.status === 'addressed') {
        await this.notificationService.notifyEmergencyAddressed(
          id,
          existingEmergency.userId,
          existingEmergency.title,
        );
      } else if (updateEmergencyDto.status === 'rejected') {
        await this.notificationService.notifyEmergencyRejected(
          id,
          existingEmergency.userId,
          existingEmergency.title,
        );
      }
    }

    this.logger.log(
      `Emergency updated successfully: ${JSON.stringify(emergency)}`,
    );
    return {
      statusCode: HttpStatus.OK,
      data: emergency,
      message: 'Emergency updated successfully.',
    };
  }

  async getAllByProjectId(projectId: number) {
    this.logger.log(`Fetching all emergencies for project ID: ${projectId}`);
    const emergencies = await this.prismaService.emergency.findMany({
      where: { projectId },
      include: {
        user: {
          include: {
            userUserTypes: {
              include: {
                userType: true,
              },
            },
          },
        },
      },
    });

    if (!emergencies || emergencies.length === 0) {
      this.logger.warn(`No emergencies found for project ID ${projectId}`);
      return {
        statusCode: HttpStatus.NOT_FOUND,
        data: [],
        message: `No emergencies found for project ID ${projectId}.`,
      };
    }

    const returnEmergencies = emergencies.map((emergency) => {
      const returnUser = {
        userId: emergency.user.userId,
        name: emergency.user.name,
        lastName: emergency.user.lastName,
        email: emergency.user.email,
        userType: emergency.user.userUserTypes[0]?.userType?.name || null,
      };
      return { ...emergency, user: returnUser };
    });

    this.logger.log(
      `Found ${emergencies.length} emergencies for project ID ${projectId}`,
    );
    return {
      statusCode: HttpStatus.OK,
      data: returnEmergencies,
      message: `Emergencies for project ID ${projectId} retrieved successfully.`,
    };
  }

  async getAllByUserId(userId: number) {
    this.logger.log(`Fetching all emergencies for user ID: ${userId}`);
    const emergencies = await this.prismaService.emergency.findMany({
      where: { userId },
      include: {
        project: true,
        user: {
          include: {
            userUserTypes: {
              include: {
                userType: true,
              },
            },
          },
        },
      },
    });

    if (!emergencies || emergencies.length === 0) {
      this.logger.warn(`No emergencies found for user ID ${userId}`);
      return {
        statusCode: HttpStatus.NOT_FOUND,
        data: [],
        message: `No emergencies found for user ID ${userId}.`,
      };
    }

    const returnEmergencies = emergencies.map((emergency) => {
      const returnUser = {
        userId: emergency.user.userId,
        name: emergency.user.name,
        lastName: emergency.user.lastName,
        email: emergency.user.email,
        userType: emergency.user.userUserTypes[0]?.userType?.name || null,
      };
      return { ...emergency, user: returnUser };
    });

    this.logger.log(
      `Found ${emergencies.length} emergencies for user ID ${userId}`,
    );
    return {
      statusCode: HttpStatus.OK,
      data: returnEmergencies,
      message: `Emergencies for user ID ${userId} retrieved successfully.`,
    };
  }
}
