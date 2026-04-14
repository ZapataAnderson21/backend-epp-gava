import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ElementControlType,
  ElementControlTypeLabelEs,
  ElementFamily,
  ElementFamilyLabelEs,
  ElementFamilyRequiresCode,
  ElementFamilyReturnsToOffice,
  ElementFamilyUsesDecimalQuantity,
  ElementFamilyUsesUniqueInventory,
  ElementTypeLabelEs,
} from 'src/element/enum/element-type.enum';
import { RegisterProjectReturnDto } from './dto/register-project-return.dto';
import {
  InventoryLocation,
  InventoryMovementType,
} from 'src/generated/prisma';

type ElementInventoryProfile = {
  family: ElementFamily | null;
  familyLabel: string;
  isLegacy: boolean;
  returnsToOffice: boolean;
  requiresCode: boolean;
  usesDecimalQuantity: boolean;
  usesUniqueInventory: boolean;
};

@Injectable()
export class InventoryService {
  constructor(private readonly prismaService: PrismaService) {}

  private normalizeQuantity(value: unknown) {
    const numberValue = Number(value ?? 0);
    return Math.round(numberValue * 10000) / 10000;
  }

  private getInventoryProfile(element: {
    family?: string | null;
    controlType: string;
    type: string;
  }): ElementInventoryProfile {
    const family = Object.values(ElementFamily).includes(
      element.family as ElementFamily,
    )
      ? (element.family as ElementFamily)
      : null;

    if (family) {
      return {
        family,
        familyLabel: ElementFamilyLabelEs[family],
        isLegacy: false,
        returnsToOffice: ElementFamilyReturnsToOffice[family],
        requiresCode: ElementFamilyRequiresCode[family],
        usesDecimalQuantity: ElementFamilyUsesDecimalQuantity[family],
        usesUniqueInventory: ElementFamilyUsesUniqueInventory[family],
      };
    }

    const controlType = element.controlType as ElementControlType;
    return {
      family: null,
      familyLabel: 'Legado',
      isLegacy: true,
      returnsToOffice: controlType !== ElementControlType.Consumable,
      requiresCode: false,
      usesDecimalQuantity: false,
      usesUniqueInventory: controlType === ElementControlType.Individual,
    };
  }

  private mapInventoryEntry(entry: any) {
    const quantityReceived = this.normalizeQuantity(entry.quantityReceived);
    const quantityReturned = this.normalizeQuantity(entry.quantityReturned);
    const quantityPending = this.normalizeQuantity(
      quantityReceived - quantityReturned,
    );
    const profile = this.getInventoryProfile(entry.element);

    return {
      projectInventoryEntryId: entry.projectInventoryEntryId,
      projectId: entry.projectId,
      projectName: entry.project?.name ?? null,
      projectCode: entry.project?.code ?? null,
      requestId: entry.requestId,
      elementId: entry.element.elementId,
      elementName: entry.element.name,
      elementCode: entry.element.code,
      elementType: entry.element.type,
      elementTypeLabel:
        ElementTypeLabelEs[entry.element.type as keyof typeof ElementTypeLabelEs] ??
        entry.element.type,
      family: profile.family,
      familyLabel: profile.familyLabel,
      isLegacy: profile.isLegacy,
      returnsToOffice: profile.returnsToOffice,
      requiresCode: profile.requiresCode,
      usesDecimalQuantity: profile.usesDecimalQuantity,
      usesUniqueInventory: profile.usesUniqueInventory,
      controlType: entry.element.controlType,
      controlTypeLabel:
        ElementControlTypeLabelEs[
          entry.element.controlType as keyof typeof ElementControlTypeLabelEs
        ] ?? entry.element.controlType,
      categoryName: entry.element.category?.name ?? null,
      unit: entry.unit,
      quantityReceived,
      quantityReturned,
      quantityPending,
      blocksProjectInactivation: profile.returnsToOffice && quantityPending > 0,
      responsibleUserId: entry.responsibleUserId,
      responsibleUserName: entry.responsibleUser
        ? `${entry.responsibleUser.name} ${entry.responsibleUser.lastName}`.trim()
        : null,
      notes: entry.notes,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      archivedAt: entry.element.deletedAt ?? null,
    };
  }

  private mapMovement(movement: any) {
    return {
      inventoryMovementId: movement.inventoryMovementId,
      movementType: movement.movementType,
      fromLocation: movement.fromLocation,
      toLocation: movement.toLocation,
      quantity: this.normalizeQuantity(movement.quantity),
      notes: movement.notes,
      createdAt: movement.createdAt,
      projectId: movement.projectId,
      projectName: movement.project?.name ?? null,
      projectCode: movement.project?.code ?? null,
      requestId: movement.requestId,
      elementId: movement.elementId,
      performedByUserName: movement.performedByUser
        ? `${movement.performedByUser.name} ${movement.performedByUser.lastName}`.trim()
        : null,
      responsibleUserName: movement.responsibleUser
        ? `${movement.responsibleUser.name} ${movement.responsibleUser.lastName}`.trim()
        : null,
    };
  }

  async receiveRequestIntoProjectInventory(
    requestId: number,
    completedByUserId: number,
  ) {
    const request = await this.prismaService.request.findUnique({
      where: { requestId },
      include: {
        project: true,
        user: true,
        elementRequests: {
          include: {
            element: {
              include: {
                category: true,
              },
            },
          },
        },
        responses: {
          include: {
            elementRequestResponses: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('No se encontro la solicitud.');
    }

    if (completedByUserId !== request.userId) {
      throw new BadRequestException(
        'Solo el responsable del requerimiento puede confirmar la recepcion final.',
      );
    }

    if (request.inventoryLoadedAt) {
      return {
        statusCode: HttpStatus.OK,
        message: 'La solicitud ya fue cargada al inventario de obra.',
        data: {
          request,
          inventoryLoaded: false,
        },
      };
    }

    if (request.status !== 'addressed' && request.status !== 'completed') {
      throw new BadRequestException(
        'Solo se puede confirmar inventario para solicitudes atendidas.',
      );
    }

    const requestResponse = request.responses[0] ?? null;
    const acceptedByElementRequestId = new Map<number, number>();

    for (const responseLine of requestResponse?.elementRequestResponses ?? []) {
      acceptedByElementRequestId.set(
        responseLine.elementRequestId,
        this.normalizeQuantity(responseLine.quantityAccepted),
      );
    }

    const result = await this.prismaService.$transaction(async (tx) => {
      const latestRequest = await tx.request.findUnique({
        where: { requestId },
      });

      if (!latestRequest) {
        throw new NotFoundException('No se encontro la solicitud.');
      }

      if (latestRequest.inventoryLoadedAt) {
        return {
          request: latestRequest,
          entries: [],
          inventoryLoaded: false,
        };
      }

      const updatedRequest = await tx.request.update({
        where: { requestId },
        data: {
          status: 'completed',
          inventoryLoadedAt: new Date(),
          inventoryReceivedByUserId: completedByUserId,
        },
      });

      const createdEntries: any[] = [];

      for (const elementRequest of request.elementRequests) {
        const quantityReceived =
          acceptedByElementRequestId.get(elementRequest.elementRequestId) ??
          this.normalizeQuantity(elementRequest.quantityRequested);

        if (quantityReceived <= 0) {
          continue;
        }

        const createdEntry = await tx.projectInventoryEntry.create({
          data: {
            projectId: request.projectId,
            elementId: elementRequest.elementId,
            requestId: request.requestId,
            requestResponseId: requestResponse?.requestResponseId ?? null,
            elementRequestId: elementRequest.elementRequestId,
            responsibleUserId: request.userId,
            unit: elementRequest.unit,
            quantityReceived,
            quantityReturned: 0,
            notes: request.description,
          },
          include: {
            project: true,
            element: {
              include: {
                category: true,
              },
            },
            responsibleUser: true,
            request: true,
          },
        });

        await tx.inventoryMovement.create({
          data: {
            projectInventoryEntryId: createdEntry.projectInventoryEntryId,
            projectId: request.projectId,
            elementId: elementRequest.elementId,
            requestId: request.requestId,
            movementType: InventoryMovementType.request_received,
            fromLocation: InventoryLocation.office,
            toLocation: InventoryLocation.project,
            quantity: quantityReceived,
            performedByUserId: completedByUserId,
            responsibleUserId: request.userId,
            notes: 'Ingreso automatico por confirmacion final del requerimiento.',
          },
        });

        createdEntries.push(createdEntry);
      }

      return {
        request: updatedRequest,
        entries: createdEntries,
        inventoryLoaded: true,
      };
    });

    return {
      statusCode: HttpStatus.OK,
      message: result.inventoryLoaded
        ? 'La solicitud fue confirmada y cargada al inventario de obra.'
        : 'La solicitud ya estaba cargada al inventario de obra.',
      data: {
        request: result.request,
        inventoryLoaded: result.inventoryLoaded,
        entries: result.entries.map((entry) => this.mapInventoryEntry(entry)),
      },
    };
  }

  async findProjectInventory(projectId: number) {
    const project = await this.prismaService.project.findFirst({
      where: { projectId, deletedAt: null },
    });

    if (!project) {
      throw new NotFoundException('No se encontro el proyecto.');
    }

    const entries = await this.prismaService.projectInventoryEntry.findMany({
      where: { projectId },
      include: {
        project: true,
        request: true,
        element: {
          include: {
            category: true,
          },
        },
        responsibleUser: true,
      },
      orderBy: [{ createdAt: 'desc' }, { projectInventoryEntryId: 'desc' }],
    });

    const mappedEntries = entries.map((entry) => this.mapInventoryEntry(entry));
    const blockers = mappedEntries.filter(
      (entry) => entry.blocksProjectInactivation,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Inventario de obra obtenido exitosamente.',
      data: {
        project: {
          projectId: project.projectId,
          name: project.name,
          code: project.code,
          status: project.status,
        },
        summary: {
          totalEntries: mappedEntries.length,
          totalPendingReturn: blockers.reduce(
            (total, entry) => total + entry.quantityPending,
            0,
          ),
          pendingBlockingEntries: blockers.length,
        },
        entries: mappedEntries,
      },
    };
  }

  async getProjectInactivationBlockers(projectId: number) {
    const entries = await this.prismaService.projectInventoryEntry.findMany({
      where: {
        projectId,
      },
      include: {
        project: true,
        request: true,
        element: {
          include: {
            category: true,
          },
        },
        responsibleUser: true,
      },
    });

    return entries
      .map((entry) => this.mapInventoryEntry(entry))
      .filter((entry) => entry.blocksProjectInactivation);
  }

  async registerProjectReturn(
    projectInventoryEntryId: number,
    registerProjectReturnDto: RegisterProjectReturnDto,
    ) {
    const entry = await this.prismaService.projectInventoryEntry.findUnique({
      where: { projectInventoryEntryId },
      include: {
        project: true,
        request: true,
        element: {
          include: {
            category: true,
          },
        },
        responsibleUser: true,
      },
    });

    if (!entry) {
      throw new NotFoundException('No se encontro el registro de inventario.');
    }

    const profile = this.getInventoryProfile(entry.element);

    if (!profile.returnsToOffice) {
      throw new BadRequestException(
        'Este elemento no requiere retorno a oficina.',
      );
    }

    const quantityPending = this.normalizeQuantity(
      this.normalizeQuantity(entry.quantityReceived) -
        this.normalizeQuantity(entry.quantityReturned),
    );
    const quantityToReturn = this.normalizeQuantity(
      registerProjectReturnDto.quantity,
    );

    if (quantityToReturn > quantityPending) {
      throw new BadRequestException(
        `Solo puedes marcar hasta ${quantityPending} unidad(es) como retornadas.`,
      );
    }

    const updatedEntry = await this.prismaService.$transaction(async (tx) => {
      const nextEntry = await tx.projectInventoryEntry.update({
        where: { projectInventoryEntryId },
        data: {
          quantityReturned: {
            increment: quantityToReturn,
          },
          notes:
            registerProjectReturnDto.notes?.trim() ||
            entry.notes ||
            undefined,
        },
        include: {
          project: true,
          request: true,
          element: {
            include: {
              category: true,
            },
          },
          responsibleUser: true,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          projectInventoryEntryId,
          projectId: entry.projectId,
          elementId: entry.elementId,
          requestId: entry.requestId,
          movementType: InventoryMovementType.returned_to_office,
          fromLocation: InventoryLocation.project,
          toLocation: InventoryLocation.office,
          quantity: quantityToReturn,
          performedByUserId: registerProjectReturnDto.performedByUserId,
          responsibleUserId: entry.responsibleUserId,
          notes:
            registerProjectReturnDto.notes?.trim() ||
            'Retorno registrado desde inventario de obra.',
        },
      });

      return nextEntry;
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Retorno registrado exitosamente.',
      data: this.mapInventoryEntry(updatedEntry),
    };
  }

  async findElementInventoryDetail(elementId: number) {
    const element = await this.prismaService.element.findFirst({
      where: {
        elementId,
      },
      include: {
        category: true,
      },
    });

    if (!element) {
      throw new NotFoundException('Elemento no encontrado.');
    }

    const entries = await this.prismaService.projectInventoryEntry.findMany({
      where: { elementId },
      include: {
        project: true,
        request: true,
        element: {
          include: {
            category: true,
          },
        },
        responsibleUser: true,
      },
      orderBy: [{ createdAt: 'desc' }, { projectInventoryEntryId: 'desc' }],
    });

    const movements = await this.prismaService.inventoryMovement.findMany({
      where: { elementId },
      include: {
        project: true,
        performedByUser: true,
        responsibleUser: true,
      },
      orderBy: [{ createdAt: 'desc' }, { inventoryMovementId: 'desc' }],
    });

    const mappedEntries = entries.map((entry) => this.mapInventoryEntry(entry));
    const currentLocations = mappedEntries.filter(
      (entry) => entry.quantityPending > 0,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Detalle de inventario del elemento obtenido exitosamente.',
      data: {
        element: {
          elementId: element.elementId,
          name: element.name,
          code: element.code,
          description: element.description,
          type: element.type,
          typeLabel:
            ElementTypeLabelEs[element.type as keyof typeof ElementTypeLabelEs] ??
            element.type,
          family: element.family,
          familyLabel: element.family
            ? ElementFamilyLabelEs[element.family as ElementFamily]
            : 'Legado',
          controlType: element.controlType,
          controlTypeLabel:
            ElementControlTypeLabelEs[
              element.controlType as keyof typeof ElementControlTypeLabelEs
            ] ?? element.controlType,
          categoryName: element.category?.name ?? null,
          isArchived: Boolean(element.deletedAt),
        },
        summary: {
          totalReceived: mappedEntries.reduce(
            (total, entry) => total + entry.quantityReceived,
            0,
          ),
          totalReturned: mappedEntries.reduce(
            (total, entry) => total + entry.quantityReturned,
            0,
          ),
          totalPending: mappedEntries.reduce(
            (total, entry) => total + entry.quantityPending,
            0,
          ),
        },
        currentLocations,
        movementHistory: movements.map((movement) => this.mapMovement(movement)),
      },
    };
  }
}
