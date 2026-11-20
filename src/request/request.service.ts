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
import { buildPaginatedData, getPaginationArgs } from 'src/common/pagination';
import { ListRequestsQueryDto } from './dto/list-requests-query.dto';
import { PermissionsService } from 'src/permissions/permissions.service';
import { CreateSsomaRequestDto } from './dto/create-ssoma-request.dto';
import { AddRequestResourceDto } from './dto/add-request-resource.dto';
import { ElementFamily } from 'src/element/enum/element-type.enum';
import type { RequestMailAudit } from 'src/mail/mail.service';

@Injectable()
export class RequestService {
  private readonly logger = new Logger('RequestService');

  constructor(
    private readonly prismaService: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly permissionsService: PermissionsService,
  ) {}

  private readonly ssomaFamilies = new Set<string>([
    ElementFamily.Uniform,
    ElementFamily.Epp,
    ElementFamily.Epi,
    ElementFamily.Ese,
  ]);

  private validateSsomaLine(
    line: {
      elementId: number;
      elementVariantId?: number | null;
      quantity: number;
      workerPlans?: Array<{ workerId: number; quantity: number }>;
    },
    element: {
      elementId: number;
      family: string | null;
      variants: Array<{ elementVariantId: number }>;
    },
  ) {
    if (!element.family || !this.ssomaFamilies.has(element.family)) {
      throw new BadRequestException(
        'El recurso seleccionado no pertenece al catálogo SSOMA.',
      );
    }

    const variant = line.elementVariantId
      ? element.variants.find(
          (item) => item.elementVariantId === line.elementVariantId,
        )
      : null;
    if (line.elementVariantId && !variant) {
      throw new BadRequestException(
        'La variante seleccionada no pertenece al recurso indicado.',
      );
    }

    const isWorkClothing = element.family === ElementFamily.Uniform;
    if (isWorkClothing && !variant) {
      throw new BadRequestException(
        'Selecciona una talla para la prenda de trabajo.',
      );
    }
    if (isWorkClothing && !Number.isInteger(line.quantity)) {
      throw new BadRequestException(
        'La cantidad de Ropa de Trabajo debe ser un número entero.',
      );
    }
    if (!isWorkClothing && line.workerPlans?.length) {
      throw new BadRequestException(
        'Los trabajadores previstos solo pueden asociarse a Ropa de Trabajo.',
      );
    }

    const workerIds = (line.workerPlans || []).map((plan) => plan.workerId);
    if (new Set(workerIds).size !== workerIds.length) {
      throw new BadRequestException(
        'No repitas un trabajador en la misma prenda y talla.',
      );
    }
    const planned = (line.workerPlans || []).reduce(
      (total, plan) => total + plan.quantity,
      0,
    );
    if (planned > line.quantity) {
      throw new BadRequestException(
        'La cantidad destinada a trabajadores supera la cantidad solicitada.',
      );
    }
  }

  async createSsoma(createDto: CreateSsomaRequestDto, userId: number) {
    const existing = await this.prismaService.request.findUnique({
      where: { clientRequestId: createDto.clientRequestId },
      select: { requestId: true },
    });
    if (existing) return this.findOne(existing.requestId, userId);

    const project = await this.prismaService.project.findFirst({
      where: { projectId: createDto.projectId, deletedAt: null },
      select: { projectId: true },
    });
    if (!project) throw new BadRequestException('El proyecto no es válido.');

    const elementIds = [
      ...new Set(createDto.lines.map((line) => line.elementId)),
    ];
    const elements = await this.prismaService.element.findMany({
      where: { elementId: { in: elementIds }, deletedAt: null },
      select: {
        elementId: true,
        family: true,
        variants: {
          where: { deletedAt: null },
          select: { elementVariantId: true },
        },
      },
    });
    const elementsById = new Map(
      elements.map((item) => [item.elementId, item]),
    );
    for (const line of createDto.lines) {
      const element = elementsById.get(line.elementId);
      if (!element)
        throw new BadRequestException('Uno de los recursos no existe.');
      this.validateSsomaLine(line, element);
    }

    const workerIds = [
      ...new Set(
        createDto.lines.flatMap((line) =>
          (line.workerPlans || []).map((plan) => plan.workerId),
        ),
      ),
    ];
    if (workerIds.length) {
      const workerCount = await this.prismaService.worker.count({
        where: { workerId: { in: workerIds }, deletedAt: null },
      });
      if (workerCount !== workerIds.length) {
        throw new BadRequestException('Uno de los trabajadores no es válido.');
      }
    }

    try {
      const requestId = await this.prismaService.$transaction(
        async (tx) => {
          const request = await tx.request.create({
            data: {
              clientRequestId: createDto.clientRequestId,
              projectId: createDto.projectId,
              userId,
              type: 'eppAndOperative',
              ssomaRequestKind: createDto.ssomaRequestKind,
              description: createDto.description?.trim() || 'Sin descripción.',
              deliveryDueDate: createDto.deliveryDueDate
                ? new Date(createDto.deliveryDueDate)
                : new Date(),
              status: 'draft',
            },
          });

          const workerMap = new Map<number, number>();
          for (const workerId of workerIds) {
            const requestWorker = await tx.requestWorker.create({
              data: { requestId: request.requestId, workerId },
            });
            workerMap.set(workerId, requestWorker.requestWorkerId);
          }

          for (const [index, line] of createDto.lines.entries()) {
            const elementRequest = await tx.elementRequest.create({
              data: {
                requestId: request.requestId,
                elementId: line.elementId,
                elementVariantId: line.elementVariantId || null,
                quantityRequested: line.quantity,
                unit: line.unit.trim(),
                notes: line.notes?.trim() || null,
                lineItemOrder: index,
              },
            });
            if (line.workerPlans?.length) {
              await tx.elementRequestWorkerPlan.createMany({
                data: line.workerPlans.map((plan) => ({
                  elementRequestId: elementRequest.elementRequestId,
                  requestWorkerId: workerMap.get(plan.workerId)!,
                  elementVariantId: line.elementVariantId || null,
                  plannedQuantity: plan.quantity,
                })),
              });
            }
          }
          return request.requestId;
        },
        { isolationLevel: 'Serializable' },
      );
      return this.findOne(requestId, userId);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        const repeated = await this.prismaService.request.findUnique({
          where: { clientRequestId: createDto.clientRequestId },
          select: { requestId: true },
        });
        if (repeated) return this.findOne(repeated.requestId, userId);
      }
      throw error;
    }
  }

  async addResource(
    requestId: number,
    dto: AddRequestResourceDto,
    actorUserId: number,
  ) {
    const permissions = await this.permissionsService.forUser(actorUserId);
    if (!permissions.includes('requests.addResource')) {
      throw new NotFoundException('El requerimiento no fue encontrado.');
    }
    const request = await this.prismaService.request.findUnique({
      where: { requestId },
      select: { requestId: true },
    });
    if (!request)
      throw new NotFoundException('El requerimiento no fue encontrado.');

    const element = await this.prismaService.element.findFirst({
      where: { elementId: dto.elementId, deletedAt: null },
      select: {
        elementId: true,
        family: true,
        variants: {
          where: { deletedAt: null },
          select: { elementVariantId: true },
        },
      },
    });
    if (!element) throw new BadRequestException('El recurso no existe.');
    this.validateSsomaLine(dto, element);

    const workerIds = (dto.workerPlans || []).map((plan) => plan.workerId);
    if (workerIds.length) {
      const count = await this.prismaService.worker.count({
        where: { workerId: { in: workerIds }, deletedAt: null },
      });
      if (count !== workerIds.length) {
        throw new BadRequestException('Uno de los trabajadores no es válido.');
      }
    }

    const origin = permissions.includes('requests.attend')
      ? 'logistics'
      : 'administration';
    const addition = await this.prismaService.$transaction(
      async (tx) =>
        tx.requestResourceAddition.create({
          data: {
            requestId,
            elementId: dto.elementId,
            elementVariantId: dto.elementVariantId || null,
            quantity: dto.quantity,
            unit: dto.unit.trim(),
            notes: dto.notes?.trim() || null,
            origin,
            addedByUserId: actorUserId,
            workerPlans: dto.workerPlans?.length
              ? {
                  create: dto.workerPlans.map((plan) => ({
                    workerId: plan.workerId,
                    plannedQuantity: plan.quantity,
                  })),
                }
              : undefined,
          },
          include: {
            element: true,
            elementVariant: true,
            addedByUser: {
              select: { userId: true, name: true, lastName: true },
            },
            workerPlans: { include: { worker: true } },
          },
        }),
      { isolationLevel: 'Serializable' },
    );
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Recurso incorporado con trazabilidad.',
      data: addition,
    };
  }

  async recordEmailAttempt(
    requestId: number,
    actorUserId: number,
    audit: RequestMailAudit | null,
    result: {
      statusCode: number;
      message: string;
      data?: unknown;
    },
    operationId?: string,
  ) {
    const providerMessageId =
      result.data &&
      typeof result.data === 'object' &&
      'messageId' in result.data &&
      typeof result.data.messageId === 'string'
        ? result.data.messageId
        : null;
    return this.prismaService.requestEmailSend.create({
      data: {
        operationId: operationId || null,
        requestId,
        sentByUserId: actorUserId,
        recipients: audit?.recipients ?? [],
        status:
          result.statusCode === Number(HttpStatus.OK) ? 'accepted' : 'failed',
        providerMessageId,
        subject:
          audit?.subject ?? `Intento de envío del requerimiento #${requestId}`,
        htmlSnapshot: audit?.htmlSnapshot ?? '',
        errorMessage:
          result.statusCode === Number(HttpStatus.OK) ? null : result.message,
        isUpdate: audit?.isUpdate ?? false,
      },
    });
  }

  async findEmailAttempt(operationId: string) {
    return this.prismaService.requestEmailSend.findUnique({
      where: { operationId },
      select: { status: true, errorMessage: true },
    });
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

    const permissions = await this.permissionsService.forUser(actorUserId);
    const isRequester = request.userId === actorUserId;
    const isLogistics = permissions.includes('requests.attend');

    if (status === RequestStatus.completed) {
      if (
        !permissions.includes('requests.manage') ||
        !isRequester ||
        request.status !== RequestStatus.addressed
      ) {
        throw new BadRequestException(
          'Solo quien solicito el requerimiento puede confirmar la recepcion total cuando esta atendido.',
        );
      }
      return;
    }

    if (
      status === RequestStatus.rejected &&
      (
        [
          RequestStatus.inProgress,
          RequestStatus.reviewed,
          RequestStatus.approved,
        ] as RequestStatus[]
      ).includes(request.status) &&
      permissions.includes('requests.approve')
    ) {
      return;
    }

    if (
      request.status === RequestStatus.draft &&
      status === RequestStatus.inProgress &&
      isRequester &&
      permissions.includes('requests.manage')
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
      permissions.includes('requests.approve')
    ) {
      return;
    }

    if (
      request.status === RequestStatus.inProgress &&
      status === RequestStatus.reviewed &&
      permissions.includes('requests.review')
    ) {
      return;
    }

    throw new BadRequestException(
      'No tienes permisos para actualizar este estado del requerimiento.',
    );
  }

  async create(createRequestDto: CreateRequestDto, userId: number) {
    this.logger.log(
      `Creating request with data: ${JSON.stringify(createRequestDto)}`,
    );

    const requestData = {
      ...createRequestDto,
      userId,
      status: RequestStatus.draft,
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

  async assertCanSendToLogistics(requestId: number, actorUserId: number) {
    const request = await this.prismaService.request.findUnique({
      where: { requestId },
      select: { userId: true, status: true },
    });

    if (!request) {
      throw new NotFoundException('La solicitud no fue encontrada');
    }

    const permissions = await this.permissionsService.forUser(actorUserId);
    if (permissions.includes('requests.sendEmail')) return;

    await this.assertCanUpdateStatus(
      { userId: request.userId, status: request.status as RequestStatus },
      RequestStatus.inProgress,
      actorUserId,
    );
  }

  async findAll(
    projectId?: number,
    userId?: number,
    status?: RequestStatus,
    viewerUserId?: number,
  ) {
    this.logger.log('Retrieving all requests');
    // Drafts are private: only the creator can see their own drafts.
    if (status === RequestStatus.draft) {
      const found = await this.prismaService.request.findMany({
        where: {
          projectId,
          status: RequestStatus.draft,
          userId: viewerUserId,
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
        ...(userId ? { userId } : {}),
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

  async findPaginated(query: ListRequestsQueryDto, viewerUserId: number) {
    const search = query.search?.trim();
    const visibility =
      query.status === RequestStatus.draft
        ? {
            status: RequestStatus.draft,
            userId: viewerUserId,
          }
        : query.status
          ? { status: query.status }
          : {
              OR: [
                { status: { not: RequestStatus.draft } },
                ...(viewerUserId
                  ? [{ status: RequestStatus.draft, userId: viewerUserId }]
                  : []),
              ],
            };
    const where = {
      projectId: query.projectId,
      ssomaRequestKind: query.ssomaRequestKind,
      ...(query.userId ? { userId: query.userId } : {}),
      ...visibility,
      ...(search
        ? {
            AND: [
              {
                OR: [
                  {
                    description: {
                      contains: search,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    project: {
                      name: { contains: search, mode: 'insensitive' as const },
                    },
                  },
                  {
                    user: {
                      name: { contains: search, mode: 'insensitive' as const },
                    },
                  },
                  {
                    user: {
                      lastName: {
                        contains: search,
                        mode: 'insensitive' as const,
                      },
                    },
                  },
                ],
              },
            ],
          }
        : {}),
    };
    const { skip, take } = getPaginationArgs(query);
    const [requests, totalItems] = await Promise.all([
      this.prismaService.request.findMany({
        where,
        include: { project: true, user: true },
        orderBy: [{ requestId: 'desc' }],
        skip,
        take,
      }),
      this.prismaService.request.count({ where }),
    ]);
    const items = requests.map((request) => ({
      ...request,
      status:
        RequestStatusLabelEs[
          request.status as keyof typeof RequestStatusLabelEs
        ] || request.status,
    }));

    return {
      statusCode: HttpStatus.OK,
      message: 'Solicitudes encontradas exitosamente.',
      data: buildPaginatedData(items, totalItems, query),
    };
  }

  async findOne(requestId: number, viewerUserId?: number) {
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
        resourceAdditions: {
          include: {
            element: { include: { category: true } },
            elementVariant: true,
            addedByUser: {
              select: { userId: true, name: true, lastName: true },
            },
            workerPlans: { include: { worker: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        emailSends: {
          select: {
            requestEmailSendId: true,
            recipients: true,
            status: true,
            providerMessageId: true,
            subject: true,
            errorMessage: true,
            isUpdate: true,
            createdAt: true,
            sentByUser: {
              select: { userId: true, name: true, lastName: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        workClothingDispatches: {
          include: { items: true },
          orderBy: { dispatchedAt: 'desc' },
        },
      },
    });

    if (!request) {
      this.logger.warn(`Request not found with ID: ${requestId}`);
      throw new BadRequestException('Request not found');
    }

    if (
      viewerUserId &&
      request.status === RequestStatus.draft &&
      request.userId !== viewerUserId
    ) {
      throw new NotFoundException('La solicitud no fue encontrada');
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

  async update(
    requestId: number,
    updateRequestDto: UpdateRequestDto,
    actorUserId: number,
  ) {
    this.logger.log(
      `Updating request ID ${requestId} with data: ${JSON.stringify(updateRequestDto)}`,
    );

    const existingRequest = await this.prismaService.request.findUnique({
      where: { requestId },
      select: { status: true, userId: true },
    });

    if (!existingRequest || existingRequest.userId !== actorUserId) {
      throw new NotFoundException('La solicitud no fue encontrada');
    }

    if (existingRequest.status !== RequestStatus.draft) {
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

  async remove(requestId: number, actorUserId: number) {
    const existingRequest = await this.prismaService.request.findUnique({
      where: { requestId },
      select: { status: true, userId: true },
    });

    if (!existingRequest || existingRequest.userId !== actorUserId) {
      throw new NotFoundException('La solicitud no fue encontrada');
    }

    const { status } = existingRequest;

    if (status !== RequestStatus.draft) {
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
}
