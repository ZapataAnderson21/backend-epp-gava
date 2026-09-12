import {
  BadRequestException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { CreateRequestResponseDto } from './dto/create-request_response.dto';
import { UpdateRequestResponseDto } from './dto/update-request-response.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RequestResponseService {
  private readonly logger = new Logger('RequestResponseService');

  constructor(private readonly prismaService: PrismaService) {}

  private async assertRequestAccessible(
    requestId: number,
    actorUserId: number,
    forWrite = false,
  ) {
    const request = await this.prismaService.request.findUnique({
      where: { requestId },
      select: { status: true, userId: true },
    });

    if (
      !request ||
      (request.status === 'draft' && request.userId !== actorUserId)
    ) {
      throw new BadRequestException('Request not found');
    }
    if (forWrite && request.status === 'draft') {
      throw new BadRequestException(
        'No se puede responder un requerimiento que sigue en borrador.',
      );
    }
  }

  async create(
    createRequestResponseDto: CreateRequestResponseDto,
    responderUserId: number,
  ) {
    await this.assertRequestAccessible(
      createRequestResponseDto.requestId,
      responderUserId,
      true,
    );
    this.logger.log(
      'Creating request response with data:',
      createRequestResponseDto,
    );

    const requestResponse = await this.prismaService.requestResponse.upsert({
      where: { requestId: createRequestResponseDto.requestId },
      create: { ...createRequestResponseDto, responderUserId },
      update: { ...createRequestResponseDto, responderUserId },
    });

    this.logger.log(
      `Created request response: ${JSON.stringify(requestResponse)}`,
    );

    if (!requestResponse) {
      this.logger.error('Failed to create request response');
      throw new BadRequestException('Failed to create request response');
    }

    return {
      statusCode: HttpStatus.OK,
      message:
        'La respuesta a la solicitud ha sido creada o actualizada exitosamente.',
      data: requestResponse,
    };
  }

  async findOne(requestResponseId: number, viewerUserId: number) {
    this.logger.log(`Finding request response with ID: ${requestResponseId}`);
    const requestResponse = await this.prismaService.requestResponse.findUnique(
      {
        where: { requestResponseId },
        include: {
          request: {
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
          },
          responder: {
            include: {
              userUserTypes: {
                include: {
                  userType: true,
                },
              },
            },
          },
        },
      },
    );

    if (!requestResponse) {
      this.logger.warn(
        `Request response not found with ID: ${requestResponseId}`,
      );
      throw new BadRequestException('Request response not found');
    }

    await this.assertRequestAccessible(requestResponse.requestId, viewerUserId);

    const returnResponder = {
      userId: requestResponse.responder
        ? requestResponse.responder.userId
        : null,
      name: requestResponse.responder ? requestResponse.responder.name : null,
      userType: requestResponse.responder
        ? requestResponse.responder.userUserTypes[0].userType.name
        : null,
    };

    const returnProjectUser = {
      userId: requestResponse.request.user
        ? requestResponse.request.user.userId
        : null,
      name: requestResponse.request.user
        ? requestResponse.request.user.name
        : null,
      userType: requestResponse.request.user
        ? requestResponse.request.user.userUserTypes[0].userType.name
        : null,
    };

    const returnProject = {
      projectId: requestResponse.request.project
        ? requestResponse.request.project.projectId
        : null,
      name: requestResponse.request.project
        ? requestResponse.request.project.name
        : null,
      code: requestResponse.request.project
        ? requestResponse.request.project.code
        : null,
      description: requestResponse.request.project
        ? requestResponse.request.project.description
        : null,
      status: requestResponse.request.project
        ? requestResponse.request.project.status
        : null,
      user: returnProjectUser,
    };

    const returnData = {
      requestResponseId: requestResponse.requestResponseId,
      request: requestResponse.request,
      responder: returnResponder,
      project: returnProject,
      createdAt: requestResponse.createdAt,
      managementDescription: requestResponse.managementDescription,
      logisticsDescription: requestResponse.logisticsDescription,
      adminDescription: requestResponse.adminDescription,
    };

    this.logger.log(
      `Found request response: ${JSON.stringify(requestResponse)}`,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Solicitud de respuesta encontrada exitosamente.',
      data: returnData,
    };
  }

  async findByRequestId(requestId: number, viewerUserId: number) {
    await this.assertRequestAccessible(requestId, viewerUserId);
    this.logger.log(`Finding request response with Request ID: ${requestId}`);
    const requestResponse = await this.prismaService.requestResponse.findUnique(
      {
        where: { requestId },
        include: {
          request: {
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
          },
          responder: {
            include: {
              userUserTypes: {
                include: {
                  userType: true,
                },
              },
            },
          },
          elementRequestResponses: {
            orderBy: [
              { updatedAt: 'desc' as const },
              { elementRequestResponseId: 'desc' as const },
            ],
          },
        },
      },
    );

    if (!requestResponse) {
      this.logger.warn(
        `No request response found for Request ID: ${requestId}`,
      );
      return {
        statusCode: HttpStatus.OK,
        message: 'No existe respuesta para esta solicitud.',
        data: null,
      };
    }

    this.logger.log(
      `Found request response: ${JSON.stringify(requestResponse)}`,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Respuesta de solicitud encontrada exitosamente.',
      data: requestResponse,
    };
  }

  async update(
    id: number,
    updateRequestResponseDto: UpdateRequestResponseDto,
    actorUserId: number,
  ) {
    const existing = await this.prismaService.requestResponse.findUnique({
      where: { requestResponseId: id },
      select: { requestId: true },
    });
    if (!existing) {
      throw new BadRequestException('Request response not found');
    }
    await this.assertRequestAccessible(existing.requestId, actorUserId, true);

    const updatedRequestResponse =
      await this.prismaService.requestResponse.update({
        where: { requestResponseId: id },
        data: updateRequestResponseDto,
      });

    if (!updatedRequestResponse) {
      this.logger.error(`Failed to update request response with ID: ${id}`);
      throw new BadRequestException(
        `Failed to update request response with ID: ${id}`,
      );
    }

    this.logger.log(
      `Updated request response: ${JSON.stringify(updatedRequestResponse)}`,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'La respuesta a la solicitud ha sido actualizada exitosamente.',
      data: updatedRequestResponse,
    };
  }
}
