import {
  BadRequestException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateElementRequestDto } from './dto/create-element_request.dto';
import { UpdateElementRequestDto } from './dto/update-element_request.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ElementFamily,
  ElementFamilyUsesUniqueInventory,
} from 'src/element/enum/element-type.enum';

@Injectable()
export class ElementRequestService {
  private readonly logger = new Logger('ElementRequestService');
  private readonly elementRequestInclude = {
    request: true,
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
  };

  constructor(private readonly prismaService: PrismaService) {}

  private normalizeQuantity(value: unknown) {
    const numberValue = Number(value ?? 0);
    return Math.round(numberValue * 10000) / 10000;
  }

  private normalizeNotes(notes?: string | null) {
    const normalized = notes?.trim();
    return normalized ? normalized : null;
  }

  private normalizeLineItemOrder(value?: number | null) {
    const numericValue = Number(value ?? 0);
    return Number.isFinite(numericValue) && numericValue >= 0
      ? Math.trunc(numericValue)
      : 0;
  }

  private resolveElementFamily(family?: string | null) {
    return Object.values(ElementFamily).includes(family as ElementFamily)
      ? (family as ElementFamily)
      : null;
  }

  private async buildElementRequestPayload(
    dto: CreateElementRequestDto | UpdateElementRequestDto,
    fallbackElementId?: number,
    fallbackRequestId?: number,
  ) {
    const fallProtectionGroup = dto.fallProtectionGroupId
      ? await this.prismaService.fallProtectionGroup.findFirst({
          where: {
            fallProtectionGroupId: dto.fallProtectionGroupId,
            deletedAt: null,
          },
        })
      : null;

    if (dto.fallProtectionGroupId && !fallProtectionGroup) {
      throw new NotFoundException('Grupo EPA no encontrado.');
    }

    const resolvedElementId =
      fallProtectionGroup?.harnessElementId ?? dto.elementId ?? fallbackElementId;
    const resolvedRequestId = dto.requestId ?? fallbackRequestId;

    if (!resolvedElementId) {
      throw new BadRequestException('Debes indicar un elemento valido.');
    }
    if (!resolvedRequestId) {
      throw new BadRequestException('Debes indicar un requerimiento valido.');
    }

    const element = await this.prismaService.element.findFirst({
      where: {
        elementId: resolvedElementId,
        deletedAt: null,
      },
      include: {
        variants: {
          where: { deletedAt: null },
        },
      },
    });

    if (!element) {
      throw new NotFoundException('Elemento no encontrado.');
    }

    if (dto.elementVariantId) {
      throw new BadRequestException(
        'Cada talla debe registrarse como un elemento independiente.',
      );
    }

    const family = this.resolveElementFamily(element.family);
    const usesUniqueInventory = family
      ? ElementFamilyUsesUniqueInventory[family]
      : false;

    const normalizedQuantity = this.normalizeQuantity(dto.quantityRequested);

    return {
      elementId: resolvedElementId,
      elementVariantId: null,
      fallProtectionGroupId: fallProtectionGroup?.fallProtectionGroupId ?? null,
      quantityRequested: usesUniqueInventory
        ? 1
        : Math.max(normalizedQuantity, 0),
      unit: usesUniqueInventory ? dto.unit?.trim() || 'UNIDAD' : dto.unit?.trim() || '',
      requestId: resolvedRequestId,
      lineItemOrder: this.normalizeLineItemOrder(dto.lineItemOrder),
      notes: this.normalizeNotes(dto.notes),
    };
  }

  async create(createElementRequestDto: CreateElementRequestDto) {
    await this.requestExists(createElementRequestDto.requestId);
    const payload = await this.buildElementRequestPayload(createElementRequestDto);

    this.logger.log(
      `Creating Element Request with data: ${JSON.stringify(createElementRequestDto)}`,
    );
    const newElementRequest = await this.prismaService.elementRequest.create({
      data: payload,
      include: this.elementRequestInclude,
    });

    if (!newElementRequest) {
      this.logger.error(`Failed to create Element Request`);
      throw new BadRequestException('Failed to create Element Request');
    }

    this.logger.log(
      `Element Request created successfully: ${JSON.stringify(newElementRequest)}`,
    );
    return {
      statusCode: HttpStatus.CREATED,
      message: 'La solicitud de elemento ha sido creada exitosamente.',
      data: newElementRequest,
    };
  }

  async findAllByRequestId(requestId: number) {
    this.logger.log(`Fetching Element Requests for requestId: ${requestId}`);
    const foundElementRequests =
      await this.prismaService.elementRequest.findMany({
        where: { requestId },
        include: this.elementRequestInclude,
        orderBy: [{ lineItemOrder: 'asc' }, { elementRequestId: 'asc' }],
      });

    if (!foundElementRequests || foundElementRequests.length === 0) {
      this.logger.warn(`No Element Requests found for requestId: ${requestId}`);
    }

    this.logger.log(
      `Found ${foundElementRequests.length} Element Requests for requestId: ${requestId}`,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Solicitudes de elementos encontradas exitosamente.',
      data: foundElementRequests,
    };
  }

  async findOne(elementRequestId: number) {
    this.logger.log(`Fetching Element Request with ID: ${elementRequestId}`);
    const elementRequest = await this.prismaService.elementRequest.findUnique({
      where: { elementRequestId },
      include: this.elementRequestInclude,
    });

    if (!elementRequest) {
      this.logger.warn(`Element Request with ID ${elementRequestId} not found`);
      throw new NotFoundException('Element request not found');
    }

    this.logger.log(`Element Request found: ${JSON.stringify(elementRequest)}`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Solicitud de elemento encontrada exitosamente.',
      data: elementRequest,
    };
  }

  async update(
    elementRequestId: number,
    updateElementRequestDto: UpdateElementRequestDto,
  ) {
    const existingElementRequest = await this.findOne(elementRequestId);

    await this.requestExistsAndIsDraft(existingElementRequest.data.requestId);
    const payload = await this.buildElementRequestPayload(
      {
        quantityRequested:
          updateElementRequestDto.quantityRequested ??
          Number(existingElementRequest.data.quantityRequested),
        unit: updateElementRequestDto.unit ?? existingElementRequest.data.unit,
        elementId:
          updateElementRequestDto.elementId ??
          existingElementRequest.data.elementId,
        elementVariantId: null,
        requestId:
          updateElementRequestDto.requestId ??
          existingElementRequest.data.requestId,
        lineItemOrder:
          updateElementRequestDto.lineItemOrder ??
          existingElementRequest.data.lineItemOrder,
        notes:
          updateElementRequestDto.notes ??
          existingElementRequest.data.notes ??
          undefined,
      },
      existingElementRequest.data.elementId,
      existingElementRequest.data.requestId,
    );

    this.logger.log(`Updating Element Request with ID: ${elementRequestId}`);
    const updatedRequest = await this.prismaService.elementRequest.update({
      where: { elementRequestId },
      data: payload,
      include: this.elementRequestInclude,
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'La solicitud de elemento ha sido actualizada exitosamente.',
      data: updatedRequest,
    };
  }

  async remove(elementRequestId: number) {
    const existingElementRequest = await this.findOne(elementRequestId);

    await this.requestExistsAndIsDraft(existingElementRequest.data.requestId);

    this.logger.log(`Deleting Element Request with ID: ${elementRequestId}`);
    const deletedElementRequest =
      await this.prismaService.elementRequest.delete({
        where: { elementRequestId },
      });

    if (!deletedElementRequest) {
      this.logger.error(
        `Failed to delete Element Request with ID: ${elementRequestId}`,
      );
      throw new BadRequestException('Failed to delete Element Request');
    }

    this.logger.log(
      `Element Request with ID: ${elementRequestId} deleted successfully`,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'La solicitud de elemento ha sido eliminada exitosamente.',
      data: deletedElementRequest,
    };
  }

  async requestExists(requestId: number) {
    const request = await this.prismaService.request.findUnique({
      where: { requestId },
    });

    if (!request) {
      this.logger.error(`Associated request with ID ${requestId} not found`);
      throw new NotFoundException('Associated request not found');
    }

    this.logger.log(`Associated request with ID ${requestId} found`);
    return {
      statusCode: HttpStatus.OK,
      message: 'La solicitud asociada fue encontrada exitosamente.',
      data: request,
    };
  }

  async requestExistsAndIsDraft(requestId: number) {
    const request = await this.prismaService.request.findUnique({
      where: { requestId },
    });

    if (!request) {
      this.logger.error(`Associated request with ID ${requestId} not found`);
      throw new NotFoundException('Associated request not found');
    }

    if (request.status !== 'draft') {
      this.logger.error(`Request with ID ${requestId} is not in draft status`);
      throw new BadRequestException(
        'The operation cannot be performed because the request is not in draft status',
      );
    }

    this.logger.log(`Request with ID ${requestId} is in draft status`);
    return {
      statusCode: HttpStatus.OK,
      message:
        'La solicitud asociada fue encontrada y está en estado de borrador.',
      data: request,
    };
  }
}
