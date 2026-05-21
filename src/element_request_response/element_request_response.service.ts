import {
  BadRequestException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateElementRequestResponseDto } from './dto/create-element_request_response.dto';
import { UpdateElementRequestResponseDto } from './dto/update-element_request_response.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { OfficeInventoryStatus } from 'src/generated/prisma';

type ResponseLineFamily = 'protection' | 'safety' | 'fallProtection' | 'other';

@Injectable()
export class ElementRequestResponseService {
  private readonly logger = new Logger('ElementRequestResponseService');

  constructor(private readonly prismaService: PrismaService) {}

  private normalizeQuantity(value: unknown) {
    const numberValue = Number(value ?? 0);
    return Math.round(numberValue * 10000) / 10000;
  }

  private getSafetyTypeName(element: any) {
    return (element?.category?.name || element?.name || 'Sin tipo').trim();
  }

  private getResponseLineFamily(elementRequest: any): ResponseLineFamily {
    if (elementRequest.fallProtectionGroupId || elementRequest.fallProtectionGroup) {
      return 'fallProtection';
    }

    const family = elementRequest.element?.family;
    const type = elementRequest.element?.type;
    const controlType = elementRequest.element?.controlType;

    if (
      ['epp', 'epi', 'uniform', 'officeMaterial', 'ssomaSupply'].includes(
        family,
      )
    ) {
      return 'protection';
    }

    if (
      family === 'ese' ||
      (!family && type === 'operative' && controlType !== 'individual')
    ) {
      return 'safety';
    }

    return 'other';
  }

  private async getOfficeStockForElement(elementId: number) {
    const aggregate = await this.prismaService.officeInventoryEntry.aggregate({
      where: {
        elementId,
        status: OfficeInventoryStatus.available,
        currentStock: { gt: 0 },
      },
      _sum: {
        currentStock: true,
      },
    });

    return this.normalizeQuantity(aggregate._sum.currentStock);
  }

  private async validateAndNormalizePayload<
    T extends CreateElementRequestResponseDto | UpdateElementRequestResponseDto,
  >(payload: T): Promise<T> {
    if (!payload.elementRequestId) {
      return payload;
    }

    const elementRequest = await this.prismaService.elementRequest.findUnique({
      where: { elementRequestId: payload.elementRequestId },
      include: {
        element: { include: { category: true } },
        fallProtectionGroup: {
          include: {
            harnessElement: true,
            anchorBandElement: true,
            lifelineElement: true,
            positioningLanyardElement: true,
          },
        },
      },
    });

    if (!elementRequest) {
      throw new NotFoundException('La linea del requerimiento no fue encontrada.');
    }

    const family = this.getResponseLineFamily(elementRequest);
    const requestedQuantity = this.normalizeQuantity(
      elementRequest.quantityRequested,
    );
    const acceptedQuantity = this.normalizeQuantity(payload.quantityAccepted);

    if (family === 'protection') {
      const availableStock = await this.getOfficeStockForElement(
        elementRequest.elementId,
      );

      if (acceptedQuantity > availableStock) {
        throw new BadRequestException(
          `Stock insuficiente para ${elementRequest.element.name}. Disponible en oficina: ${availableStock}; cantidad aceptada: ${acceptedQuantity}.`,
        );
      }

      return {
        ...payload,
        quantityAccepted: acceptedQuantity,
        selectedElementIds: [],
      };
    }

    if (family === 'safety') {
      const selectedElementIds = Array.from(
        new Set((payload.selectedElementIds || []).map(Number).filter(Boolean)),
      );

      if (selectedElementIds.length === 0) {
        return {
          ...payload,
          quantityAccepted: 0,
          selectedElementIds: [],
        };
      }

      const selectedElements = await this.prismaService.element.findMany({
        where: {
          elementId: { in: selectedElementIds },
          OR: [
            { family: 'ese' },
            {
              family: null,
              type: 'operative',
              controlType: { not: 'individual' },
            },
          ],
          deletedAt: null,
        },
        include: {
          category: true,
          officeInventoryEntries: {
            where: {
              status: OfficeInventoryStatus.available,
              currentStock: { gt: 0 },
            },
          },
        },
      });

      if (selectedElements.length !== selectedElementIds.length) {
        throw new BadRequestException(
          'Uno o mas equipos seleccionados no existen, no son ESE o no estan disponibles en oficina.',
        );
      }

      const requestedType = this.getSafetyTypeName(elementRequest.element);
      const invalidType = selectedElements.find(
        (element) => this.getSafetyTypeName(element) !== requestedType,
      );

      if (invalidType) {
        throw new BadRequestException(
          `El equipo ${invalidType.name} no corresponde al tipo solicitado (${requestedType}).`,
        );
      }

      const unavailable = selectedElements.find(
        (element) => element.officeInventoryEntries.length === 0,
      );

      if (unavailable) {
        throw new BadRequestException(
          `El equipo ${unavailable.name}${unavailable.code ? ` - ${unavailable.code}` : ''} no tiene stock disponible en oficina.`,
        );
      }

      return {
        ...payload,
        quantityAccepted: selectedElementIds.length,
        selectedElementIds,
      };
    }

    if (family === 'fallProtection') {
      if (![0, 1].includes(acceptedQuantity)) {
        throw new BadRequestException(
          'Los grupos EPA solo pueden aceptarse o cancelarse.',
        );
      }

      if (acceptedQuantity === 1) {
        const parts = [
          elementRequest.fallProtectionGroup?.harnessElement,
          elementRequest.fallProtectionGroup?.anchorBandElement,
          elementRequest.fallProtectionGroup?.lifelineElement,
          elementRequest.fallProtectionGroup?.positioningLanyardElement,
        ].filter(Boolean);

        const inoperativePart = parts.find((part: any) =>
          ['inoperativo', 'inoperative'].includes(
            String(part.operationalStatus || '').toLowerCase(),
          ),
        );

        if (inoperativePart) {
          throw new BadRequestException(
            `No se puede aceptar el grupo EPA porque ${inoperativePart.name} esta inoperativo.`,
          );
        }
      }

      return {
        ...payload,
        quantityAccepted: acceptedQuantity,
        selectedElementIds: [],
      };
    }

    return {
      ...payload,
      quantityAccepted: acceptedQuantity,
      selectedElementIds: [],
    };
  }

  async create(
    createElementRequestResponseDto: CreateElementRequestResponseDto,
  ) {
    this.logger.log(
      `Creating ElementRequestResponse with data: ${JSON.stringify(createElementRequestResponseDto)}`,
    );
    const payload = await this.validateAndNormalizePayload(
      createElementRequestResponseDto,
    );
    const existingElementRequestResponse =
      await this.prismaService.elementRequestResponse.findFirst({
        where: {
          elementRequestId: payload.elementRequestId,
          requestResponseId: payload.requestResponseId,
        },
      });

    const elementRequestResponse = existingElementRequestResponse
      ? await this.prismaService.elementRequestResponse.update({
          where: {
            elementRequestResponseId:
              existingElementRequestResponse.elementRequestResponseId,
          },
          data: payload,
          include: {
            elementRequest: true,
            requestResponse: true,
          },
        })
      : await this.prismaService.elementRequestResponse.create({
          data: payload,
          include: {
            elementRequest: true,
            requestResponse: true,
          },
        });

    if (!elementRequestResponse) {
      this.logger.error('Failed to create ElementRequestResponse');
      throw new BadRequestException('Failed to create ElementRequestResponse');
    }

    this.logger.log(
      `ElementRequestResponse created successfully: ${JSON.stringify(elementRequestResponse)}`,
    );
    return {
      statusCode: existingElementRequestResponse
        ? HttpStatus.OK
        : HttpStatus.CREATED,
      message:
        'La respuesta a la solicitud de elemento ha sido creada o actualizada exitosamente.',
      data: elementRequestResponse,
    };
  }

  async findByRequestResponseId(requestResponseId: number) {
    this.logger.log(
      `Finding ElementRequestResponses by requestResponseId: ${requestResponseId}`,
    );
    const elementRequestResponses =
      await this.prismaService.elementRequestResponse.findMany({
        where: { requestResponseId: requestResponseId },
        include: {
          elementRequest: true,
          requestResponse: true,
        },
      });

    if (!elementRequestResponses || elementRequestResponses.length === 0) {
      this.logger.warn(
        `No ElementRequestResponses found for requestResponseId: ${requestResponseId}`,
      );
    }

    this.logger.log(
      `Found ${elementRequestResponses.length} ElementRequestResponses for requestResponseId: ${requestResponseId}`,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Solicitudes de respuesta a elementos encontradas exitosamente.',
      data: elementRequestResponses,
    };
  }

  async findOne(elementRequestResponseId: number) {
    this.logger.log(
      `Finding ElementRequestResponse by id: ${elementRequestResponseId}`,
    );
    const elementRequestResponse =
      await this.prismaService.elementRequestResponse.findUnique({
        where: { elementRequestResponseId },
        include: {
          elementRequest: true,
          requestResponse: true,
        },
      });

    if (!elementRequestResponse) {
      this.logger.warn(
        `ElementRequestResponse not found for id: ${elementRequestResponseId}`,
      );
      throw new NotFoundException(
        `ElementRequestResponse with id ${elementRequestResponseId} not found`,
      );
    }

    this.logger.log(
      `ElementRequestResponse found: ${JSON.stringify(elementRequestResponse)}`,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Solicitud de respuesta a elemento encontrada exitosamente.',
      data: elementRequestResponse,
    };
  }

  async update(
    elementRequestResponseId: number,
    updateElementRequestResponseDto: UpdateElementRequestResponseDto,
  ) {
    this.logger.log(
      `Updating ElementRequestResponse with id: ${elementRequestResponseId}`,
    );
    const updatedElementRequestResponse =
      await this.prismaService.elementRequestResponse.update({
        where: { elementRequestResponseId },
        data: await this.validateAndNormalizePayload(
          updateElementRequestResponseDto,
        ),
        include: {
          elementRequest: true,
          requestResponse: true,
        },
      });

    if (!updatedElementRequestResponse) {
      this.logger.error(
        `Failed to update ElementRequestResponse with id: ${elementRequestResponseId}`,
      );
      throw new BadRequestException(
        `Failed to update ElementRequestResponse with id: ${elementRequestResponseId}`,
      );
    }

    this.logger.log(
      `ElementRequestResponse updated successfully: ${JSON.stringify(updatedElementRequestResponse)}`,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Solicitud de respuesta a elemento actualizada exitosamente.',
      data: updatedElementRequestResponse,
    };
  }
}
