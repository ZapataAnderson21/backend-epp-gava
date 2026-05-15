import {
  BadRequestException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { RequestStatus, RequestStatusLabelEs } from './enum';
import { NotificationService } from 'src/notification/notification.service';
import { InventoryService } from 'src/inventory/inventory.service';

const REQUEST_STATUS_MANAGERS = ['ADMINISTRADORA', 'GERENTE'];

@Injectable()
export class RequestService {
  private readonly logger = new Logger('RequestService');

  constructor(
    private readonly prismaService: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly inventoryService: InventoryService,
  ) {}

  private async getUserTypeNames(userId: number) {
    const links = await this.prismaService.userUserType.findMany({
      where: { userId },
      include: { userType: true },
    });

    return links.map((link) => link.userType.name);
  }

  private isRequestStatusManager(userTypes: string[]) {
    return userTypes.some((type) => REQUEST_STATUS_MANAGERS.includes(type));
  }

  private async assertCanUpdateStatus(
    request: {
      userId: number;
      status: RequestStatus;
    },
    status: RequestStatus,
    actorUserId?: number,
  ) {
    if (!actorUserId) {
      throw new BadRequestException(
        'Se requiere identificar al usuario que actualiza el estado.',
      );
    }

    const userTypes = await this.getUserTypeNames(actorUserId);
    const isManager = this.isRequestStatusManager(userTypes);
    const isRequester = request.userId === actorUserId;
    const isLogistics = userTypes.includes('LOGISTICA');

    if (status === RequestStatus.completed) {
      if (!isRequester || request.status !== RequestStatus.addressed) {
        throw new BadRequestException(
          'Solo quien solicito el requerimiento puede confirmar la recepcion total cuando esta atendido.',
        );
      }
      return;
    }

    if (isManager) {
      return;
    }

    if (
      request.status === RequestStatus.draft &&
      status === RequestStatus.inProgress &&
      isRequester
    ) {
      return;
    }

    if (
      request.status === RequestStatus.approved &&
      status === RequestStatus.addressed &&
      isLogistics
    ) {
      return;
    }

    if (
      request.status === RequestStatus.reviewed &&
      status === RequestStatus.approved &&
      userTypes.includes('GERENTE')
    ) {
      return;
    }

    if (
      request.status === RequestStatus.inProgress &&
      status === RequestStatus.reviewed &&
      userTypes.includes('ADMINISTRADORA')
    ) {
      return;
    }

    throw new BadRequestException(
      'No tienes permisos para actualizar este estado del requerimiento.',
    );
  }

  async create(createRequestDto: CreateRequestDto) {
    this.logger.log(
      `Creating request with data: ${JSON.stringify(createRequestDto)}`,
    );

    const requestData = {
      ...createRequestDto,
      deliveryDueDate: new Date(createRequestDto.deliveryDueDate),
    };

    const request = await this.prismaService.request.create({
      data: requestData,
      include: {
        project: { select: { projectId: true, name: true } },
      },
    });

    if (!request) {
      this.logger.error('Failed to create request', createRequestDto);
      throw new BadRequestException('Failed to create request');
    }

    // Notificar a ADMINISTRADORA y LOGISTICA sobre la nueva solicitud
    // Solo notificar si el estado no es draft
    if (request.status !== 'draft') {
      await this.notificationService.notifyRequestCreated(
        request.requestId,
        request.projectId,
        request.project.name,
        request.type,
      );
    }

    this.logger.log(`Request created successfully: ${JSON.stringify(request)}`);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'La solicitud ha sido creada exitosamente.',
      data: request,
    };
  }

  async findAll(
    projectId?: number,
    userId?: number,
    status?: RequestStatus,
    viewerId?: number,
  ) {
    this.logger.log('Retrieving all requests');
    const viewerUserId = userId || viewerId;

    // Drafts are private: only the creator can see their own drafts.
    if (status === RequestStatus.draft) {
      const found = await this.prismaService.request.findMany({
        where: {
          projectId,
          status: RequestStatus.draft,
          ...(viewerUserId ? { userId: viewerUserId } : {}),
        },
        include: { project: true, user: true },
        orderBy: { requestId: 'desc' },
      });

      const processed = found.map((req) => ({
        ...req,
        status:
          RequestStatusLabelEs[
            req.status as keyof typeof RequestStatusLabelEs
          ] || req.status,
      }));

      return {
        statusCode: processed.length ? HttpStatus.OK : HttpStatus.NOT_FOUND,
        message: processed.length
          ? 'Solicitudes encontradas exitosamente.'
          : 'No se han encontrado solicitudes.',
        data: processed,
      };
    }

    // Once a request leaves draft, it is visible to everyone.
    // Without a status filter, include all non-drafts plus only my drafts.
    const found = await this.prismaService.request.findMany({
      where: {
        projectId,
        ...(status
          ? { status }
          : {
              OR: [
                { status: { not: RequestStatus.draft } },
                ...(viewerUserId
                  ? [
                      {
                        AND: [
                          { status: RequestStatus.draft },
                          { userId: viewerUserId },
                        ],
                      },
                    ]
                  : []),
              ],
            }),
      },
      include: { project: true, user: true },
      orderBy: { requestId: 'desc' },
    });

    const processed = found.map((req) => ({
      ...req,
      status:
        RequestStatusLabelEs[req.status as keyof typeof RequestStatusLabelEs] ||
        req.status,
    }));

    return {
      statusCode: processed.length ? HttpStatus.OK : HttpStatus.NOT_FOUND,
      message: processed.length
        ? 'Solicitudes encontradas exitosamente.'
        : 'No se han encontrado solicitudes.',
      data: processed,
    };
  }

  async findOne(requestId: number) {
    this.logger.log(`Finding request with ID: ${requestId}`);
    const request = await this.prismaService.request.findUnique({
      where: { requestId },
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
        elementRequests: {
          orderBy: [{ lineItemOrder: 'asc' }, { elementRequestId: 'asc' }],
          include: {
            element: {
              include: {
                category: true,
                variants: {
                  where: { deletedAt: null },
                  orderBy: { label: 'asc' as const },
                },
              },
            },
              elementVariant: true,
              fallProtectionGroup: {
                include: {
                  harnessElement: { include: { category: true } },
                  anchorBandElement: { include: { category: true } },
                  lifelineElement: { include: { category: true } },
                  positioningLanyardElement: { include: { category: true } },
                },
              },
              elementRequestResponses: {
                include: {
                  requestResponse: true,
                },
                orderBy: [
                  { updatedAt: 'desc' as const },
                  { elementRequestResponseId: 'desc' as const },
                ],
              },
            epiPlans: {
              include: {
                elementVariant: true,
                requestWorker: {
                  include: {
                    worker: true,
                  },
                },
              },
            },
          },
        },
        requestWorkers: {
          include: {
            worker: true,
          },
        },
      },
    });

    if (!request) {
      this.logger.warn(`Request not found with ID: ${requestId}`);
      throw new BadRequestException('Request not found');
    }

    const processedRequest = {
      ...request,
      status:
        RequestStatusLabelEs[
          request.status as keyof typeof RequestStatusLabelEs
        ] || request.status,
    };

    this.logger.log(`Request with ID ${requestId} found`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Solicitud encontrada exitosamente.',
      data: processedRequest,
    };
  }

  async findAllByProjectId(projectId: number) {
    this.logger.log(`Finding all requests for project ID: ${projectId}`);
    const foundRequests = await this.prismaService.request.findMany({
      where: { projectId },
      include: {
        project: true,
        user: true,
      },
    });

    if (!foundRequests || foundRequests.length === 0) {
      this.logger.warn(`No requests found for project ID: ${projectId}`);
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No se han encontrado solicitudes para este proyecto.',
        data: [],
      };
    }

    const processedRequests = foundRequests.map((request) => {
      const requestObj = {
        ...request,
        status:
          RequestStatusLabelEs[
            request.status as keyof typeof RequestStatusLabelEs
          ] || request.status,
      };
      return requestObj;
    });

    this.logger.log(
      `Found ${foundRequests.length} requests for project ID: ${projectId}`,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Solicitudes encontradas exitosamente.',
      data: processedRequests,
    };
  }

  async findAllByUserId(userId: number) {
    this.logger.log(`Finding all requests for user ID: ${userId}`);
    const foundRequests = (
      await this.prismaService.request.findMany({
        where: { userId },
        include: {
          project: true,
          user: true,
        },
      })
    ).sort((a, b) => a.requestId - b.requestId);

    if (!foundRequests || foundRequests.length === 0) {
      this.logger.warn(`No requests found for user ID: ${userId}`);
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No se han encontrado solicitudes para este usuario.',
        data: [],
      };
    }

    const processedRequests = foundRequests.map((request) => {
      const requestObj = {
        ...request,
        status:
          RequestStatusLabelEs[
            request.status as keyof typeof RequestStatusLabelEs
          ] || request.status,
      };
      return requestObj;
    });

    this.logger.log(
      `Found ${foundRequests.length} requests for user ID: ${userId}`,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Solicitudes encontradas exitosamente.',
      data: processedRequests,
    };
  }

  async findAllByStatus(status: RequestStatus) {
    this.logger.log(`Finding all requests with status: ${status}`);
    const foundRequests = (
      await this.prismaService.request.findMany({
        where: { status },
        include: {
          project: true,
          user: true,
        },
      })
    ).sort((a, b) => b.requestId - a.requestId);

    if (!foundRequests || foundRequests.length === 0) {
      this.logger.warn(`No requests found with status: ${status}`);
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No se han encontrado solicitudes con este estado.',
        data: [],
      };
    }

    const processedRequests = foundRequests.map((request) => {
      const requestObj = {
        ...request,
        status:
          RequestStatusLabelEs[
            request.status as keyof typeof RequestStatusLabelEs
          ] || request.status,
      };
      return requestObj;
    });

    this.logger.log(
      `Found ${foundRequests.length} requests with status: ${status}`,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Solicitudes encontradas exitosamente.',
      data: processedRequests,
    };
  }

  async updateStatus(
    requestId: number,
    status: RequestStatus,
    actorUserId?: number,
  ) {
    this.logger.log(`Updating status of request ID ${requestId} to ${status}`);

    this.logger.log(`Verifying existence of request ID: ${requestId}`);
    const existingRequest = await this.prismaService.request.findUnique({
      where: { requestId },
      include: {
        project: { select: { projectId: true, name: true } },
      },
    });

    if (!existingRequest) {
      throw new NotFoundException('La solicitud no fue encontrada');
    }

    await this.assertCanUpdateStatus(
      {
        userId: existingRequest.userId,
        status: existingRequest.status as RequestStatus,
      },
      status,
      actorUserId,
    );

    if (status === RequestStatus.completed) {
      return await this.inventoryService.receiveRequestIntoProjectInventory(
        requestId,
        actorUserId!,
      );
    }

    const previousStatus = existingRequest.status;

    this.logger.log(
      `Request ID ${requestId} exists. Proceeding to update status.`,
    );
    const updatedRequest = await this.prismaService.request.update({
      where: { requestId },
      data: { status },
      include: {
        project: { select: { projectId: true, name: true } },
      },
    });

    if (!updatedRequest) {
      this.logger.error(`Failed to update status for request ID: ${requestId}`);
      throw new BadRequestException('Failed to update request status');
    }

    // Notificar al creador de la solicitud según el cambio de estado
    const creatorUserId = existingRequest.userId;

    // Si pasó de draft a otro estado, notificar a ADMINISTRADORA/LOGISTICA
    if (previousStatus === 'draft' && status !== 'draft') {
      await this.notificationService.notifyRequestCreated(
        requestId,
        updatedRequest.projectId,
        updatedRequest.project.name,
        updatedRequest.type,
      );
    }

    // Notificar aprobación o rechazo al creador
    if (status === RequestStatus.approved) {
      await this.notificationService.notifyRequestApproved(
        requestId,
        creatorUserId,
        updatedRequest.description,
      );
    } else if (status === RequestStatus.rejected) {
      await this.notificationService.notifyRequestRejected(
        requestId,
        creatorUserId,
      );
    }

    this.logger.log(
      `Request ID ${requestId} status updated successfully to ${status}`,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'El estado de la solicitud ha sido actualizado exitosamente.',
      data: updatedRequest,
    };
  }

  async update(requestId: number, updateRequestDto: UpdateRequestDto) {
    this.logger.log(
      `Updating request ID ${requestId} with data: ${JSON.stringify(updateRequestDto)}`,
    );

    if (!this.requestIsDraft(requestId)) {
      this.logger.error(
        `Cannot update request ID ${requestId} because its status is not 'draft'`,
      );
      throw new BadRequestException(
        'Only requests with status "draft" can be updated',
      );
    }

    const updateData = {
      ...updateRequestDto,
      ...(updateRequestDto.deliveryDueDate && {
        deliveryDueDate: new Date(updateRequestDto.deliveryDueDate),
      }),
    };

    const updatedRequest = await this.prismaService.request.update({
      where: { requestId },
      data: updateData,
    });

    if (!updatedRequest) {
      this.logger.error(`Failed to update request ID ${requestId}`);
      throw new BadRequestException('Failed to update request');
    }

    this.logger.log(
      `Request ID ${requestId} updated successfully: ${JSON.stringify(updatedRequest)}`,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'La solicitud ha sido actualizada exitosamente.',
      data: updatedRequest,
    };
  }

  async remove(requestId: number) {
    const existingRequest = (await this.findOne(requestId)).data;

    const { status } = existingRequest;

    if (status !== 'draft') {
      this.logger.error(
        `Cannot delete request ID ${requestId} because its status is not 'draft'`,
      );
      throw new BadRequestException(
        'Only requests with status "draft" can be deleted',
      );
    }

    const deletedRequest = await this.prismaService.request.delete({
      where: { requestId },
    });

    if (!deletedRequest) {
      this.logger.error(`Failed to delete request ID ${requestId}`);
      throw new BadRequestException('Failed to delete request');
    }

    this.logger.log(`Request ID ${requestId} deleted successfully`);
    return {
      statusCode: HttpStatus.OK,
      message: 'La solicitud ha sido eliminada exitosamente.',
      data: deletedRequest,
    };
  }

  async requestIsDraft(requestId: number) {
    this.logger.log(
      `Verifying existence of request ID: ${requestId} and checking if its status is 'draft'`,
    );
    const request = await this.prismaService.request.findUnique({
      where: { requestId },
    });

    if (!request) {
      this.logger.error(`Request ID ${requestId} not found`);
      throw new NotFoundException('La solicitud no fue encontrada');
    }

    if (request.status !== 'draft') {
      this.logger.error(`Request ID ${requestId} is not in 'draft' status`);
      return false;
    }

    this.logger.log(`Request ID ${requestId} exists and is in 'draft' status`);
    return true;
  }
}
