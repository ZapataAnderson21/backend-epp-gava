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
import { RegisterOfficeEntryDto } from './dto/register-office-entry.dto';
import { RegisterDisposalDto } from './dto/register-disposal.dto';
import { RegisterMaintenanceDto } from './dto/register-maintenance.dto';
import { RegisterAdjustmentDto } from './dto/register-adjustment.dto';
import { RegisterTransferDto } from './dto/register-transfer.dto';
import { FindMovementsQueryDto } from './dto/find-movements-query.dto';
import { RegisterWorkerAssignmentDto } from './dto/register-worker-assignment.dto';
import {
  RegisterWorkerAssignmentsDto,
} from './dto/register-worker-assignments.dto';
import {
  InventoryLocation,
  InventoryMovementType,
  OfficeInventoryStatus,
  WorkerInventoryAssignmentStatus,
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

  // ─── Helpers ──────────────────────────────────────────────────

  private normalizeQuantity(value: unknown) {
    const numberValue = Number(value ?? 0);
    return Math.round(numberValue * 10000) / 10000;
  }

  private normalizeAssignmentDate(assignedAt?: string) {
    if (!assignedAt) return new Date();

    const date = new Date(assignedAt);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('La fecha de asignacion no es valida.');
    }

    return date;
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

  private getFallProtectionElementLabel(element?: {
    name?: string | null;
    code?: string | null;
  } | null) {
    if (!element) return 'Pendiente';
    return element.code ? `${element.name} - ${element.code}` : element.name;
  }

  private getFallProtectionGroupParts(group?: any) {
    if (!group) return [];

    return [
      `Arnes: ${this.getFallProtectionElementLabel(group.harnessElement)}`,
      `Banda de anclaje: ${this.getFallProtectionElementLabel(group.anchorBandElement)}`,
      `Linea de vida: ${this.getFallProtectionElementLabel(group.lifelineElement)}`,
      `Eslinga de posicionamiento: ${this.getFallProtectionElementLabel(group.positioningLanyardElement)}`,
    ];
  }

  private isSafetyRequestLine(element: {
    family?: string | null;
    type: string;
    controlType: string;
  }) {
    return (
      element.family === ElementFamily.Ese ||
      (!element.family &&
        element.type === 'operative' &&
        element.controlType !== ElementControlType.Individual)
    );
  }

  private getActiveAssignedPending(assignments?: any[]) {
    return this.normalizeQuantity(
      (assignments || []).reduce((total, assignment) => {
        const isActive = [
          WorkerInventoryAssignmentStatus.active,
          WorkerInventoryAssignmentStatus.partially_returned,
        ].includes(assignment.status);

        if (!isActive) return total;

        return (
          total +
          this.normalizeQuantity(
            this.normalizeQuantity(assignment.quantityAssigned) -
              this.normalizeQuantity(assignment.quantityReturned),
          )
        );
      }, 0),
    );
  }

  private mapProjectEntryAssignment(assignment: any, entry: any) {
    const quantityAssigned = this.normalizeQuantity(
      assignment.quantityAssigned,
    );
    const quantityReturned = this.normalizeQuantity(
      assignment.quantityReturned,
    );

    return {
      workerInventoryAssignmentId: assignment.workerInventoryAssignmentId,
      workerId: assignment.workerId,
      workerName: assignment.worker?.fullName ?? null,
      projectId: assignment.projectId ?? entry.projectId,
      projectName: entry.project?.name ?? null,
      projectCode: entry.project?.code ?? null,
      elementId: assignment.elementId ?? entry.elementId,
      elementName: entry.fallProtectionGroupId
        ? entry.fallProtectionGroup?.code ?? entry.element?.name ?? null
        : entry.element?.name ?? null,
      elementCode: entry.fallProtectionGroupId
        ? entry.fallProtectionGroup?.code ?? entry.element?.code ?? null
        : entry.element?.code ?? null,
      elementVariantId: assignment.elementVariantId ?? entry.elementVariantId ?? null,
      elementVariantLabel:
        entry.elementVariant?.label ?? entry.elementVariant?.normalizedLabel ?? null,
      family: entry.fallProtectionGroupId
        ? ElementFamily.Harness
        : entry.element?.family ?? null,
      familyLabel: entry.fallProtectionGroupId
        ? ElementFamilyLabelEs[ElementFamily.Harness]
        : this.getInventoryProfile(entry.element).familyLabel,
      controlType: entry.element?.controlType ?? null,
      categoryName: entry.fallProtectionGroupId
        ? 'Grupo EPA'
        : entry.element?.category?.name ?? null,
      inventoryAssetId: assignment.inventoryAssetId ?? null,
      assetCode: assignment.inventoryAsset?.assetCode ?? null,
      serialNumber: assignment.inventoryAsset?.serialNumber ?? null,
      sourceProjectInventoryEntryId:
        assignment.sourceProjectInventoryEntryId ?? entry.projectInventoryEntryId,
      quantityAssigned,
      quantityReturned,
      quantityPending: this.normalizeQuantity(quantityAssigned - quantityReturned),
      status: assignment.status,
      assignedAt: assignment.assignedAt,
      returnedAt: assignment.returnedAt,
      notes: assignment.notes,
    };
  }

  private mapInventoryEntry(entry: any) {
    const quantityReceived = this.normalizeQuantity(entry.quantityReceived);
    const quantityReturned = this.normalizeQuantity(entry.quantityReturned);
    const quantityPending = this.normalizeQuantity(
      quantityReceived - quantityReturned,
    );
    const quantityAssignedToWorkers = this.getActiveAssignedPending(
      entry.workerInventoryAssignments,
    );
    const quantityAvailableInProject = this.normalizeQuantity(
      Math.max(quantityPending - quantityAssignedToWorkers, 0),
    );
    const isFallProtectionGroup = Boolean(entry.fallProtectionGroupId);
    const profile = isFallProtectionGroup
      ? {
          family: ElementFamily.Harness,
          familyLabel: ElementFamilyLabelEs[ElementFamily.Harness],
          isLegacy: false,
          returnsToOffice: ElementFamilyReturnsToOffice[ElementFamily.Harness],
          requiresCode: ElementFamilyRequiresCode[ElementFamily.Harness],
          usesDecimalQuantity:
            ElementFamilyUsesDecimalQuantity[ElementFamily.Harness],
          usesUniqueInventory:
            ElementFamilyUsesUniqueInventory[ElementFamily.Harness],
        }
      : this.getInventoryProfile(entry.element);
    const fallProtectionParts = this.getFallProtectionGroupParts(
      entry.fallProtectionGroup,
    );

    const quantityRequiredForProjectClosure = profile.returnsToOffice
      ? quantityPending
      : 0;

    return {
      projectInventoryEntryId: entry.projectInventoryEntryId,
      projectId: entry.projectId,
      projectName: entry.project?.name ?? null,
      projectCode: entry.project?.code ?? null,
        requestId: entry.requestId,
        elementId: entry.element.elementId,
        elementVariantId: entry.elementVariantId ?? null,
        fallProtectionGroupId: entry.fallProtectionGroupId ?? null,
        fallProtectionGroup: entry.fallProtectionGroup ?? null,
        elementVariantLabel:
        entry.elementVariant?.label ?? entry.elementVariant?.normalizedLabel ?? null,
      elementName: isFallProtectionGroup
        ? entry.fallProtectionGroup?.code ?? entry.element.name
        : entry.element.name,
      elementCode: isFallProtectionGroup
        ? entry.fallProtectionGroup?.code ?? entry.element.code
        : entry.element.code,
      fallProtectionParts,
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
      categoryName: isFallProtectionGroup
        ? 'Grupo EPA'
        : entry.element.category?.name ?? null,
      unit: entry.unit,
      quantityReceived,
      quantityReturned,
      quantityPending,
      quantityAssignedToWorkers,
      quantityAvailableForAssignment: quantityAvailableInProject,
      quantityAvailableForReturn: quantityAvailableInProject,
      quantityRequiredForProjectClosure,
      workerAssignments: (entry.workerInventoryAssignments || []).map(
        (assignment) => this.mapProjectEntryAssignment(assignment, entry),
      ),
      blocksProjectInactivation: quantityRequiredForProjectClosure > 0,
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

  private getProjectInventoryAggregateKey(entry: any) {
    if (entry.fallProtectionGroupId) {
      return `fall-protection:${entry.fallProtectionGroupId}`;
    }

    return [
      'element',
      entry.projectId,
      entry.elementId,
      entry.elementVariantId ?? 'base',
    ].join(':');
  }

  private aggregateProjectInventoryEntries(entries: any[]) {
    const grouped = new Map<string, any[]>();

    for (const entry of entries) {
      const key = this.getProjectInventoryAggregateKey(entry);
      grouped.set(key, [...(grouped.get(key) ?? []), entry]);
    }

    return [...grouped.values()].map((groupEntries) => {
      const [first] = groupEntries;
      const isFallProtectionGroup = Boolean(first.fallProtectionGroupId);
      const quantityReceived = isFallProtectionGroup
        ? Math.min(
            1,
            groupEntries.reduce(
              (total, entry) => total + this.normalizeQuantity(entry.quantityReceived),
              0,
            ),
          )
        : groupEntries.reduce(
            (total, entry) => total + this.normalizeQuantity(entry.quantityReceived),
            0,
          );
      const quantityReturned = isFallProtectionGroup
        ? Math.min(
            quantityReceived,
            groupEntries.reduce(
              (total, entry) => total + this.normalizeQuantity(entry.quantityReturned),
              0,
            ),
          )
        : groupEntries.reduce(
            (total, entry) => total + this.normalizeQuantity(entry.quantityReturned),
            0,
          );
      const workerAssignments = groupEntries.flatMap(
        (entry) => entry.workerAssignments ?? [],
      );
      const quantityAssignedToWorkers = isFallProtectionGroup
        ? Math.min(
            quantityReceived,
            workerAssignments.reduce(
              (total, assignment) =>
                total + this.normalizeQuantity(assignment.quantityPending),
              0,
            ),
          )
        : workerAssignments.reduce(
            (total, assignment) =>
              total + this.normalizeQuantity(assignment.quantityPending),
            0,
          );
      const quantityPending = this.normalizeQuantity(
        quantityReceived - quantityReturned,
      );
      const quantityAvailableInProject = this.normalizeQuantity(
        Math.max(quantityPending - quantityAssignedToWorkers, 0),
      );
      const responsibleNames = [
        ...new Set(
          groupEntries
            .map((entry) => entry.responsibleUserName)
            .filter(Boolean),
        ),
      ];
      const quantityRequiredForProjectClosure = first.returnsToOffice
        ? quantityPending
        : 0;

      return {
        ...first,
        projectInventoryEntryIds: groupEntries.map(
          (entry) => entry.projectInventoryEntryId,
        ),
        requestIds: [...new Set(groupEntries.map((entry) => entry.requestId))],
        quantityReceived: this.normalizeQuantity(quantityReceived),
        quantityReturned: this.normalizeQuantity(quantityReturned),
        quantityPending,
        quantityAssignedToWorkers: this.normalizeQuantity(
          quantityAssignedToWorkers,
        ),
        quantityAvailableForAssignment: quantityAvailableInProject,
        quantityAvailableForReturn: quantityAvailableInProject,
        quantityRequiredForProjectClosure,
        workerAssignments,
        blocksProjectInactivation: quantityRequiredForProjectClosure > 0,
        responsibleUserNames: responsibleNames,
        responsibleUserName:
          responsibleNames.length <= 1
            ? responsibleNames[0] ?? null
            : `Varios responsables (${responsibleNames.length})`,
      };
    });
  }

  private mapFallProtectionGroupsByPart(groups: any[]) {
    const byElementId = new Map<number, any>();

    for (const group of groups) {
      [
        group.harnessElementId,
        group.anchorBandElementId,
        group.lifelineElementId,
        group.positioningLanyardElementId,
      ]
        .filter(Boolean)
        .forEach((elementId) => byElementId.set(Number(elementId), group));
    }

    return byElementId;
  }

  private normalizeProjectEntryFallProtectionGroup(
    entry: any,
    groupByPartElementId: Map<number, any>,
  ) {
    if (entry.fallProtectionGroupId || entry.element?.family !== ElementFamily.Harness) {
      return entry;
    }

    const group = groupByPartElementId.get(entry.elementId);
    if (!group) return entry;

    return {
      ...entry,
      fallProtectionGroupId: group.fallProtectionGroupId,
      fallProtectionGroup: group,
    };
  }

  private getProjectEntryQuantityPending(entry: any) {
    return this.normalizeQuantity(
      this.normalizeQuantity(entry.quantityReceived) -
        this.normalizeQuantity(entry.quantityReturned),
    );
  }

  private getProjectEntryAvailableInProject(entry: any) {
    const quantityPending = this.getProjectEntryQuantityPending(entry);
    const assignedPending = this.getActiveAssignedPending(
      entry.workerInventoryAssignments,
    );

    return this.normalizeQuantity(Math.max(quantityPending - assignedPending, 0));
  }

  private getProjectEntryReturnsToOffice(entry: any) {
    if (entry.fallProtectionGroupId) return true;
    return this.getInventoryProfile(entry.element).returnsToOffice;
  }

  private async findRelatedProjectInventoryEntries(
    projectInventoryEntryId: number,
  ) {
    const sourceEntry =
      await this.prismaService.projectInventoryEntry.findUnique({
        where: { projectInventoryEntryId },
        include: this.projectEntryInclude,
      });

    if (!sourceEntry) {
      throw new NotFoundException('No se encontro el registro de inventario.');
    }

    const fallProtectionGroups =
      await this.prismaService.fallProtectionGroup.findMany({
        where: { deletedAt: null },
        include: this.fallProtectionGroupInclude,
      });
    const groupByPartElementId =
      this.mapFallProtectionGroupsByPart(fallProtectionGroups);
    const normalizedSource = this.normalizeProjectEntryFallProtectionGroup(
      sourceEntry,
      groupByPartElementId,
    );
    const aggregateKey =
      this.getProjectInventoryAggregateKey(normalizedSource);

    const projectEntries =
      await this.prismaService.projectInventoryEntry.findMany({
        where: { projectId: sourceEntry.projectId },
        include: this.projectEntryInclude,
        orderBy: [{ createdAt: 'asc' }, { projectInventoryEntryId: 'asc' }],
      });

    const entries = projectEntries
      .map((entry) =>
        this.normalizeProjectEntryFallProtectionGroup(
          entry,
          groupByPartElementId,
        ),
      )
      .filter(
        (entry) => this.getProjectInventoryAggregateKey(entry) === aggregateKey,
      );

    return {
      sourceEntry: normalizedSource,
      entries,
      isFallProtectionGroup: Boolean(normalizedSource.fallProtectionGroupId),
    };
  }

  private mapOfficeInventoryEntry(entry: any) {
    const profile = this.getInventoryProfile(entry.element);
    const rawCurrentStock = this.normalizeQuantity(entry.currentStock);
    const currentStock = profile.usesUniqueInventory
      ? entry.status === OfficeInventoryStatus.disposed || rawCurrentStock <= 0
        ? 0
        : 1
      : rawCurrentStock;

    return {
      officeInventoryEntryId: entry.officeInventoryEntryId,
      elementId: entry.element.elementId,
      elementVariantId: entry.elementVariantId ?? null,
      elementVariantLabel:
        entry.elementVariant?.label ?? entry.elementVariant?.normalizedLabel ?? null,
      elementName: entry.element.name,
      elementCode: entry.element.code,
      elementType: entry.element.type,
      elementTypeLabel:
        ElementTypeLabelEs[entry.element.type as keyof typeof ElementTypeLabelEs] ??
        entry.element.type,
      family: profile.family,
      familyLabel: profile.familyLabel,
      isLegacy: profile.isLegacy,
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
      currentStock,
      status: entry.status,
      purchaseOrderId: entry.purchaseOrderId,
      purchaseOrderCode: entry.purchaseOrder?.code ?? null,
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
      workerId: movement.workerId,
      workerName: movement.worker?.fullName ?? null,
      requestId: movement.requestId,
      elementId: movement.elementId,
      elementVariantId: movement.elementVariantId ?? null,
      elementVariantLabel:
        movement.elementVariant?.label ??
        movement.elementVariant?.normalizedLabel ??
        null,
      elementName: movement.element?.name ?? null,
      elementCode: movement.element?.code ?? null,
      officeInventoryEntryId: movement.officeInventoryEntryId,
      projectInventoryEntryId: movement.projectInventoryEntryId,
      performedByUserName: movement.performedByUser
        ? `${movement.performedByUser.name} ${movement.performedByUser.lastName}`.trim()
        : null,
      responsibleUserName: movement.responsibleUser
        ? `${movement.responsibleUser.name} ${movement.responsibleUser.lastName}`.trim()
        : null,
    };
  }

  private mapWorkerInventoryAssignment(assignment: any) {
    const quantityAssigned = this.normalizeQuantity(assignment.quantityAssigned);
    const quantityReturned = this.normalizeQuantity(assignment.quantityReturned);
    const quantityPending = this.normalizeQuantity(
      quantityAssigned - quantityReturned,
    );
    const profile = this.getInventoryProfile(assignment.element);

    return {
      workerInventoryAssignmentId: assignment.workerInventoryAssignmentId,
      workerId: assignment.workerId,
      workerName: assignment.worker?.fullName ?? null,
      projectId: assignment.projectId,
      projectName: assignment.project?.name ?? null,
      projectCode: assignment.project?.code ?? null,
      elementId: assignment.elementId,
      elementName: assignment.element?.name ?? null,
      elementCode: assignment.element?.code ?? null,
      elementVariantId: assignment.elementVariantId ?? null,
      elementVariantLabel:
        assignment.elementVariant?.label ??
        assignment.elementVariant?.normalizedLabel ??
        null,
      family: profile.family,
      familyLabel: profile.familyLabel,
      controlType: assignment.element?.controlType ?? null,
      categoryName: assignment.element?.category?.name ?? null,
      inventoryAssetId: assignment.inventoryAssetId ?? null,
      assetCode: assignment.inventoryAsset?.assetCode ?? null,
      serialNumber: assignment.inventoryAsset?.serialNumber ?? null,
      sourceProjectInventoryEntryId:
        assignment.sourceProjectInventoryEntryId ?? null,
      quantityAssigned,
      quantityReturned,
      quantityPending,
      status: assignment.status,
      assignedAt: assignment.assignedAt,
      returnedAt: assignment.returnedAt,
      notes: assignment.notes,
    };
  }

  private getMonthRange(month?: number, year?: number) {
    const today = new Date();
    const safeYear = year || today.getFullYear();
    const safeMonth = month && month >= 1 && month <= 12
      ? month
      : today.getMonth() + 1;

    const from = new Date(Date.UTC(safeYear, safeMonth - 1, 1, 0, 0, 0, 0));
    const to = new Date(Date.UTC(safeYear, safeMonth, 1, 0, 0, 0, 0));

    return { month: safeMonth, year: safeYear, from, to };
  }

  private readonly officeEntryInclude = {
    element: {
      include: { category: true },
    },
    elementVariant: true,
    purchaseOrder: true,
  };

  private readonly fallProtectionGroupInclude = {
    harnessElement: { include: { category: true } },
    anchorBandElement: { include: { category: true } },
    lifelineElement: { include: { category: true } },
    positioningLanyardElement: { include: { category: true } },
  };

  private readonly projectEntryInclude = {
    project: true,
    request: true,
    element: {
      include: {
        category: true,
      },
      },
      elementVariant: true,
      fallProtectionGroup: {
        include: this.fallProtectionGroupInclude,
      },
      responsibleUser: true,
      workerInventoryAssignments: {
        include: {
          worker: true,
          inventoryAsset: true,
        },
        orderBy: [
          { assignedAt: 'desc' as const },
          { workerInventoryAssignmentId: 'desc' as const },
        ],
      },
    };

  private readonly movementInclude = {
    project: true,
    worker: true,
    element: true,
    elementVariant: true,
    performedByUser: true,
    responsibleUser: true,
  };

  private readonly workerAssignmentInclude = {
    worker: true,
    project: true,
    element: {
      include: {
        category: true,
      },
    },
    elementVariant: true,
    inventoryAsset: true,
    sourceProjectInventoryEntry: true,
  };

  async findDashboard(query: { month?: number; year?: number }) {
    const { month, year, from, to } = this.getMonthRange(
      query.month,
      query.year,
    );
    const protectionFamilies = [
      ElementFamily.Epp,
      ElementFamily.Epi,
      ElementFamily.Uniform,
    ];

    const [movements, officeEntries, projectEntries, latestMovements] =
      await Promise.all([
        this.prismaService.inventoryMovement.findMany({
          where: {
            movementType: InventoryMovementType.assigned_to_worker,
            createdAt: { gte: from, lt: to },
            element: {
              family: { in: protectionFamilies },
              deletedAt: null,
            },
          },
          include: this.movementInclude,
          orderBy: [{ createdAt: 'desc' }],
        }),
        this.prismaService.officeInventoryEntry.findMany({
          include: this.officeEntryInclude,
        }),
        this.prismaService.projectInventoryEntry.findMany({
          include: this.projectEntryInclude,
        }),
        this.prismaService.inventoryMovement.findMany({
          include: this.movementInclude,
          orderBy: [{ createdAt: 'desc' }, { inventoryMovementId: 'desc' }],
          take: 8,
        }),
      ]);

    const deliveredByElement = new Map<
      number,
      {
        elementId: number;
        elementName: string;
        family: ElementFamily | null;
        familyLabel: string;
        deliveredQuantity: number;
      }
    >();

    for (const movement of movements) {
      const profile = this.getInventoryProfile(movement.element);
      const current = deliveredByElement.get(movement.elementId) ?? {
        elementId: movement.elementId,
        elementName: movement.element?.name ?? 'Elemento',
        family: profile.family,
        familyLabel: profile.familyLabel,
        deliveredQuantity: 0,
      };

      current.deliveredQuantity += this.normalizeQuantity(movement.quantity);
      deliveredByElement.set(movement.elementId, current);
    }

    const officeByElement = new Map<number, number>();
    for (const entry of officeEntries) {
      officeByElement.set(
        entry.elementId,
        this.normalizeQuantity(officeByElement.get(entry.elementId) ?? 0) +
          this.normalizeQuantity(entry.currentStock),
      );
    }

    const projectByElement = new Map<number, number>();
    for (const entry of projectEntries) {
      const pending = this.normalizeQuantity(
        this.normalizeQuantity(entry.quantityReceived) -
          this.normalizeQuantity(entry.quantityReturned),
      );
      projectByElement.set(
        entry.elementId,
        this.normalizeQuantity(projectByElement.get(entry.elementId) ?? 0) +
          pending,
      );
    }

    const elementsWithMinimum = await this.prismaService.element.findMany({
      where: {
        deletedAt: null,
        family: { in: protectionFamilies },
        stockMinimum: { gt: 0 },
      },
      include: { category: true },
      orderBy: { name: 'asc' },
    });

    const minimumStock = elementsWithMinimum
      .map((element) => {
        const officeStock = this.normalizeQuantity(
          officeByElement.get(element.elementId) ?? 0,
        );
        const projectStock = this.normalizeQuantity(
          projectByElement.get(element.elementId) ?? 0,
        );
        const stockMinimum = this.normalizeQuantity(element.stockMinimum);
        const distanceToMinimum = this.normalizeQuantity(
          officeStock - stockMinimum,
        );
        const profile = this.getInventoryProfile(element);

        return {
          elementId: element.elementId,
          elementName: element.name,
          family: profile.family,
          familyLabel: profile.familyLabel,
          categoryName: element.category?.name ?? null,
          officeStock,
          projectStock,
          totalStock: this.normalizeQuantity(officeStock + projectStock),
          stockMinimum,
          distanceToMinimum,
        };
      })
      .sort((a, b) => a.distanceToMinimum - b.distanceToMinimum)
      .slice(0, 6);

    return {
      statusCode: HttpStatus.OK,
      message: 'Dashboard de inventario obtenido exitosamente.',
      data: {
        period: { month, year },
        mostDelivered: [...deliveredByElement.values()]
          .sort((a, b) => b.deliveredQuantity - a.deliveredQuantity)
          .slice(0, 10),
        minimumStock,
        latestMovements: latestMovements.map((movement) =>
          this.mapMovement(movement),
        ),
      },
    };
  }

  async registerWorkerAssignment(
    projectInventoryEntryId: number,
    dto: RegisterWorkerAssignmentDto,
  ) {
    const entry = await this.prismaService.projectInventoryEntry.findUnique({
      where: { projectInventoryEntryId },
      include: this.projectEntryInclude,
    });

    if (!entry) {
      throw new NotFoundException('No se encontro el registro de inventario.');
    }

    const worker = await this.prismaService.worker.findFirst({
      where: { workerId: dto.workerId, deletedAt: null },
    });

    if (!worker) {
      throw new NotFoundException('Trabajador no encontrado.');
    }

    const profile = this.getInventoryProfile(entry.element);
    const allowedFamilies = [
      ElementFamily.Epp,
      ElementFamily.Epi,
      ElementFamily.Uniform,
      ElementFamily.Harness,
    ];

    if (!profile.family || !allowedFamilies.includes(profile.family)) {
      if (profile.family === ElementFamily.SsomaSupply) {
        throw new BadRequestException(
          'Los Insumos SSOMA no se asignan a trabajadores.',
        );
      }

      throw new BadRequestException(
        'Solo se pueden asignar EP y EPA a trabajadores. Los ESE permanecen en obra.',
      );
    }

    const activeAssignments =
      await this.prismaService.workerInventoryAssignment.findMany({
        where: {
          sourceProjectInventoryEntryId: projectInventoryEntryId,
          status: {
            in: [
              WorkerInventoryAssignmentStatus.active,
              WorkerInventoryAssignmentStatus.partially_returned,
            ],
          },
        },
      });

    const assignedPending = activeAssignments.reduce(
      (total, assignment) =>
        total +
        this.normalizeQuantity(
          this.normalizeQuantity(assignment.quantityAssigned) -
            this.normalizeQuantity(assignment.quantityReturned),
        ),
      0,
    );
    const projectPending = this.normalizeQuantity(
      this.normalizeQuantity(entry.quantityReceived) -
        this.normalizeQuantity(entry.quantityReturned),
    );
    const availableToAssign = this.normalizeQuantity(
      projectPending - assignedPending,
    );
    const quantity = this.normalizeQuantity(dto.quantity);
    const assignedAt = this.normalizeAssignmentDate(dto.assignedAt);

    if (quantity > availableToAssign) {
      throw new BadRequestException(
        `Solo hay ${availableToAssign} unidad(es) disponibles para asignar.`,
      );
    }

    const assignment = await this.prismaService.$transaction(async (tx) => {
      const createdAssignment = await tx.workerInventoryAssignment.create({
        data: {
          workerId: dto.workerId,
          projectId: entry.projectId,
          elementId: entry.elementId,
          elementVariantId: entry.elementVariantId ?? null,
          sourceProjectInventoryEntryId: projectInventoryEntryId,
          quantityAssigned: quantity,
          quantityReturned: 0,
          status: WorkerInventoryAssignmentStatus.active,
          assignedAt,
          notes: dto.notes?.trim() || null,
        },
        include: this.workerAssignmentInclude,
      });

      await tx.inventoryMovement.create({
        data: {
          projectInventoryEntryId,
          workerInventoryAssignmentId:
            createdAssignment.workerInventoryAssignmentId,
          projectId: entry.projectId,
          workerId: dto.workerId,
          elementId: entry.elementId,
          elementVariantId: entry.elementVariantId ?? null,
          requestId: entry.requestId,
          movementType: InventoryMovementType.assigned_to_worker,
          fromLocation: InventoryLocation.project,
          toLocation: InventoryLocation.worker,
          quantity,
          performedByUserId: dto.performedByUserId,
          responsibleUserId: entry.responsibleUserId,
          notes: dto.notes?.trim() || 'Asignacion a trabajador.',
        },
      });

      return createdAssignment;
    });

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Asignacion a trabajador registrada exitosamente.',
      data: this.mapWorkerInventoryAssignment(assignment),
    };
  }

  async registerWorkerAssignments(
    projectInventoryEntryId: number,
    dto: RegisterWorkerAssignmentsDto,
  ) {
    const { sourceEntry: entry, entries, isFallProtectionGroup } =
      await this.findRelatedProjectInventoryEntries(projectInventoryEntryId);

    const profile = entry.fallProtectionGroupId
      ? { family: ElementFamily.Harness }
      : this.getInventoryProfile(entry.element);
    const allowedFamilies = [
      ElementFamily.Epp,
      ElementFamily.Epi,
      ElementFamily.Uniform,
      ElementFamily.Harness,
    ];

    if (!profile.family || !allowedFamilies.includes(profile.family)) {
      if (profile.family === ElementFamily.SsomaSupply) {
        throw new BadRequestException(
          'Los Insumos SSOMA no se asignan a trabajadores.',
        );
      }

      throw new BadRequestException(
        'Solo se pueden asignar EP y EPA a trabajadores. Los ESE permanecen en obra.',
      );
    }

    const cleanAssignments = dto.assignments.map((assignment) => ({
      workerId: Number(assignment.workerId),
      quantity: this.normalizeQuantity(assignment.quantity),
      assignedAt: this.normalizeAssignmentDate(
        assignment.assignedAt ?? dto.assignedAt,
      ),
      notes: assignment.notes?.trim() || null,
    }));
    const requestedQuantity = this.normalizeQuantity(
      cleanAssignments.reduce(
        (total, assignment) => total + assignment.quantity,
        0,
      ),
    );
    const availableEntries = entries
      .map((item) => ({
        entry: item,
        available: this.getProjectEntryAvailableInProject(item),
      }))
      .filter((item) => item.available > 0);
    const availableToAssign = this.normalizeQuantity(
      isFallProtectionGroup
        ? Math.min(
            1,
            availableEntries.reduce((total, item) => total + item.available, 0),
          )
        : availableEntries.reduce((total, item) => total + item.available, 0),
    );

    if (requestedQuantity > availableToAssign) {
      throw new BadRequestException(
        `Solo hay ${availableToAssign} unidad(es) disponibles para asignar.`,
      );
    }

    const workerIds = [...new Set(cleanAssignments.map((item) => item.workerId))];
    const workers = await this.prismaService.worker.findMany({
      where: { workerId: { in: workerIds }, deletedAt: null },
    });

    if (workers.length !== workerIds.length) {
      throw new NotFoundException(
        'Uno o mas trabajadores seleccionados no existen o estan inactivos.',
      );
    }

    const assignments = await this.prismaService.$transaction(async (tx) => {
      const createdAssignments: any[] = [];
      const availability = availableEntries.map((item) => ({ ...item }));

      for (const assignment of cleanAssignments) {
        let remaining = assignment.quantity;

        for (const availableItem of availability) {
          if (remaining <= 0) break;
          if (availableItem.available <= 0) continue;

          const quantity = this.normalizeQuantity(
            Math.min(remaining, availableItem.available),
          );
          const source = availableItem.entry;
          const createdAssignment = await tx.workerInventoryAssignment.create({
            data: {
              workerId: assignment.workerId,
              projectId: source.projectId,
              elementId: source.elementId,
              elementVariantId: source.elementVariantId ?? null,
              sourceProjectInventoryEntryId: source.projectInventoryEntryId,
              quantityAssigned: quantity,
              quantityReturned: 0,
              status: WorkerInventoryAssignmentStatus.active,
              assignedAt: assignment.assignedAt,
              notes: assignment.notes,
            },
            include: this.workerAssignmentInclude,
          });

          await tx.inventoryMovement.create({
            data: {
              projectInventoryEntryId: source.projectInventoryEntryId,
              workerInventoryAssignmentId:
                createdAssignment.workerInventoryAssignmentId,
              projectId: source.projectId,
              workerId: assignment.workerId,
              elementId: source.elementId,
              elementVariantId: source.elementVariantId ?? null,
              requestId: source.requestId,
              movementType: InventoryMovementType.assigned_to_worker,
              fromLocation: InventoryLocation.project,
              toLocation: InventoryLocation.worker,
              quantity,
              performedByUserId: dto.performedByUserId,
              responsibleUserId: source.responsibleUserId,
              notes: assignment.notes || 'Asignacion a trabajador.',
            },
          });

          availableItem.available = this.normalizeQuantity(
            availableItem.available - quantity,
          );
          remaining = this.normalizeQuantity(remaining - quantity);
          createdAssignments.push(createdAssignment);
        }
      }

      return createdAssignments;
    });

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Asignaciones a trabajadores registradas exitosamente.',
      data: assignments.map((assignment) =>
        this.mapWorkerInventoryAssignment(assignment),
      ),
    };
  }

  async deleteWorkerAssignment(workerInventoryAssignmentId: number) {
    const assignment =
      await this.prismaService.workerInventoryAssignment.findUnique({
        where: { workerInventoryAssignmentId },
        include: {
          ...this.workerAssignmentInclude,
          movements: true,
        },
      });

    if (!assignment) {
      throw new NotFoundException('Asignacion a trabajador no encontrada.');
    }

    if (this.normalizeQuantity(assignment.quantityReturned) > 0) {
      throw new BadRequestException(
        'No se puede eliminar una asignacion que ya tiene retornos registrados.',
      );
    }

    const hasNonAssignmentMovements = assignment.movements.some(
      (movement) =>
        movement.movementType !== InventoryMovementType.assigned_to_worker,
    );

    if (
      assignment.status !== WorkerInventoryAssignmentStatus.active ||
      hasNonAssignmentMovements
    ) {
      throw new BadRequestException(
        'Esta asignacion ya tiene historial asociado y no puede eliminarse.',
      );
    }

    await this.prismaService.$transaction(async (tx) => {
      await tx.inventoryMovement.deleteMany({
        where: {
          workerInventoryAssignmentId,
          movementType: InventoryMovementType.assigned_to_worker,
        },
      });

      await tx.workerInventoryAssignment.delete({
        where: { workerInventoryAssignmentId },
      });
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Asignacion a trabajador eliminada exitosamente.',
      data: this.mapWorkerInventoryAssignment(assignment),
    };
  }

  async findWorkerInventoryHistory(
    workerId: number,
    query: { family?: string; month?: number; year?: number },
  ) {
    const worker = await this.prismaService.worker.findFirst({
      where: { workerId, deletedAt: null },
    });

    if (!worker) {
      throw new NotFoundException('Trabajador no encontrado.');
    }

    const where: any = { workerId };

    if (
      query.family &&
      Object.values(ElementFamily).includes(query.family as ElementFamily)
    ) {
      where.element = { family: query.family as ElementFamily };
    }

    const hasValidMonth =
      typeof query.month === 'number' && query.month >= 1 && query.month <= 12;
    const hasValidYear = typeof query.year === 'number' && query.year > 0;

    if (hasValidMonth || hasValidYear) {
      const safeYear = hasValidYear ? query.year! : new Date().getFullYear();
      const from = hasValidMonth
        ? new Date(Date.UTC(safeYear, query.month! - 1, 1, 0, 0, 0, 0))
        : new Date(Date.UTC(safeYear, 0, 1, 0, 0, 0, 0));
      const to = hasValidMonth
        ? new Date(Date.UTC(safeYear, query.month!, 1, 0, 0, 0, 0))
        : new Date(Date.UTC(safeYear + 1, 0, 1, 0, 0, 0, 0));
      where.assignedAt = { gte: from, lt: to };
    }

    const assignments =
      await this.prismaService.workerInventoryAssignment.findMany({
        where,
        include: this.workerAssignmentInclude,
        orderBy: [
          { assignedAt: 'desc' },
          { workerInventoryAssignmentId: 'desc' },
        ],
      });

    const mappedAssignments = assignments.map((assignment) =>
      this.mapWorkerInventoryAssignment(assignment),
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Historial de inventario del trabajador obtenido exitosamente.',
      data: {
        worker: {
          workerId: worker.workerId,
          fullName: worker.fullName,
          dni: worker.dni,
        },
        summary: {
          totalQuantity: mappedAssignments.reduce(
            (total, assignment) => total + assignment.quantityAssigned,
            0,
          ),
          activeQuantity: mappedAssignments.reduce(
            (total, assignment) => total + assignment.quantityPending,
            0,
          ),
          totalAssignments: mappedAssignments.length,
        },
        assignments: mappedAssignments,
      },
    };
  }

  // ─── Office Inventory ────────────────────────────────────────

  async registerOfficeEntry(dto: RegisterOfficeEntryDto) {
    const element = await this.prismaService.element.findFirst({
      where: { elementId: dto.elementId, deletedAt: null },
      include: { category: true },
    });

    if (!element) {
      throw new NotFoundException('Elemento no encontrado.');
    }

    const profile = this.getInventoryProfile(element);
    const quantity = this.normalizeQuantity(dto.quantity);
    const unit =
      profile.family === ElementFamily.SsomaSupply ? 'unidad' : dto.unit;

    if (profile.usesUniqueInventory && quantity !== 1) {
      throw new BadRequestException(
        'Los elementos con inventario unico solo aceptan cantidad 1 por registro.',
      );
    }

    const result = await this.prismaService.$transaction(async (tx) => {
      let officeEntry: any;

      if (profile.usesUniqueInventory) {
        const [existingOfficeEntries, existingProjectEntries, existingMovements] =
          await Promise.all([
            tx.officeInventoryEntry.count({ where: { elementId: dto.elementId } }),
            tx.projectInventoryEntry.count({ where: { elementId: dto.elementId } }),
            tx.inventoryMovement.count({ where: { elementId: dto.elementId } }),
          ]);

        if (
          existingOfficeEntries > 0 ||
          existingProjectEntries > 0 ||
          existingMovements > 0
        ) {
          throw new BadRequestException(
            'Este item se maneja como equipo unico y ya tiene trazabilidad. No se pueden registrar ingresos manuales de stock.',
          );
        }

        // Unique items: one record per physical unit — always create new
        officeEntry = await tx.officeInventoryEntry.create({
          data: {
            elementId: dto.elementId,
            unit,
            currentStock: 1,
            status: OfficeInventoryStatus.available,
            purchaseOrderId: dto.purchaseOrderId ?? null,
            notes: dto.notes?.trim() || null,
          },
          include: this.officeEntryInclude,
        });
      } else {
        // Stock items: upsert — find existing or create, then increment
        const existing = await tx.officeInventoryEntry.findFirst({
          where: {
            elementId: dto.elementId,
            status: OfficeInventoryStatus.available,
          },
        });

        if (existing) {
          officeEntry = await tx.officeInventoryEntry.update({
            where: { officeInventoryEntryId: existing.officeInventoryEntryId },
            data: {
              currentStock: { increment: quantity },
              unit,
              notes: dto.notes?.trim() || existing.notes || undefined,
            },
            include: this.officeEntryInclude,
          });
        } else {
          officeEntry = await tx.officeInventoryEntry.create({
            data: {
              elementId: dto.elementId,
              unit,
              currentStock: quantity,
              status: OfficeInventoryStatus.available,
              purchaseOrderId: dto.purchaseOrderId ?? null,
              notes: dto.notes?.trim() || null,
            },
            include: this.officeEntryInclude,
          });
        }
      }

      await tx.inventoryMovement.create({
        data: {
          officeInventoryEntryId: officeEntry.officeInventoryEntryId,
          elementId: dto.elementId,
          movementType: InventoryMovementType.office_entry,
          fromLocation: InventoryLocation.external,
          toLocation: InventoryLocation.office,
          quantity,
          performedByUserId: dto.performedByUserId,
          notes: dto.notes?.trim() || 'Ingreso a inventario de oficina.',
        },
      });

      return officeEntry;
    });

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Ingreso a inventario de oficina registrado exitosamente.',
      data: this.mapOfficeInventoryEntry(result),
    };
  }

  async findOfficeInventory() {
    const entries = await this.prismaService.officeInventoryEntry.findMany({
      include: this.officeEntryInclude,
      orderBy: [{ updatedAt: 'desc' }, { officeInventoryEntryId: 'desc' }],
    });

    const mapped = entries.map((e) => this.mapOfficeInventoryEntry(e));

    return {
      statusCode: HttpStatus.OK,
      message: 'Inventario de oficina obtenido exitosamente.',
      data: {
        summary: {
          totalEntries: mapped.length,
          totalAvailable: mapped.filter((e) => e.status === 'available').length,
          totalInMaintenance: mapped.filter((e) => e.status === 'in_maintenance').length,
          totalDisposed: mapped.filter((e) => e.status === 'disposed').length,
        },
        entries: mapped,
      },
    };
  }

  async findOfficeInventoryEntry(officeInventoryEntryId: number) {
    const entry = await this.prismaService.officeInventoryEntry.findUnique({
      where: { officeInventoryEntryId },
      include: {
        ...this.officeEntryInclude,
        movements: {
          include: this.movementInclude,
          orderBy: [{ createdAt: 'desc' }],
        },
      },
    });

    if (!entry) {
      throw new NotFoundException('Registro de inventario de oficina no encontrado.');
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Detalle de inventario de oficina obtenido exitosamente.',
      data: {
        ...this.mapOfficeInventoryEntry(entry),
        movements: entry.movements.map((m: any) => this.mapMovement(m)),
      },
    };
  }

  // ─── Disposal ────────────────────────────────────────────────

  async registerOfficeDisposal(
    officeInventoryEntryId: number,
    dto: RegisterDisposalDto,
  ) {
    const entry = await this.prismaService.officeInventoryEntry.findUnique({
      where: { officeInventoryEntryId },
      include: this.officeEntryInclude,
    });

    if (!entry) {
      throw new NotFoundException('Registro de inventario de oficina no encontrado.');
    }

    if (entry.status === OfficeInventoryStatus.disposed) {
      throw new BadRequestException('Este registro ya fue dado de baja.');
    }

    const currentStock = this.normalizeQuantity(entry.currentStock);
    const quantityToDispose = this.normalizeQuantity(dto.quantity);
    const profile = this.getInventoryProfile(entry.element);

    if (profile.usesUniqueInventory) {
      throw new BadRequestException(
        'Este item se maneja como equipo unico. No se registran salidas manuales de stock; usa los flujos de requerimiento, retorno o cambio de estado.',
      );
    }

    if (quantityToDispose > currentStock) {
      throw new BadRequestException(
        `Solo puedes dar de baja hasta ${currentStock} unidad(es). Stock actual insuficiente.`,
      );
    }

    const newStock = this.normalizeQuantity(currentStock - quantityToDispose);
    const newStatus =
      profile.usesUniqueInventory || newStock <= 0
        ? OfficeInventoryStatus.disposed
        : entry.status;

    const updatedEntry = await this.prismaService.$transaction(async (tx) => {
      const updated = await tx.officeInventoryEntry.update({
        where: { officeInventoryEntryId },
        data: {
          currentStock: { decrement: quantityToDispose },
          status: newStatus,
        },
        include: this.officeEntryInclude,
      });

      await tx.inventoryMovement.create({
        data: {
          officeInventoryEntryId,
          elementId: entry.elementId,
          movementType: InventoryMovementType.disposal,
          fromLocation: InventoryLocation.office,
          toLocation: InventoryLocation.external,
          quantity: quantityToDispose,
          performedByUserId: dto.performedByUserId,
          notes: `Baja: ${dto.reason}${dto.notes ? ` — ${dto.notes.trim()}` : ''}`,
        },
      });

      return updated;
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Baja registrada exitosamente.',
      data: this.mapOfficeInventoryEntry(updatedEntry),
    };
  }

  // ─── Maintenance ─────────────────────────────────────────────

  async registerMaintenanceOut(
    officeInventoryEntryId: number,
    dto: RegisterMaintenanceDto,
  ) {
    const entry = await this.prismaService.officeInventoryEntry.findUnique({
      where: { officeInventoryEntryId },
      include: this.officeEntryInclude,
    });

    if (!entry) {
      throw new NotFoundException('Registro de inventario de oficina no encontrado.');
    }

    if (entry.status !== OfficeInventoryStatus.available) {
      throw new BadRequestException(
        'Solo se pueden enviar a mantenimiento elementos disponibles.',
      );
    }

    const currentStock = this.normalizeQuantity(entry.currentStock);
    const quantity = this.normalizeQuantity(dto.quantity);

    if (quantity > currentStock) {
      throw new BadRequestException(
        `Solo puedes enviar hasta ${currentStock} unidad(es) a mantenimiento.`,
      );
    }

    const profile = this.getInventoryProfile(entry.element);
    const newStatus =
      profile.usesUniqueInventory
        ? OfficeInventoryStatus.in_maintenance
        : entry.status;

    const updatedEntry = await this.prismaService.$transaction(async (tx) => {
      const updated = await tx.officeInventoryEntry.update({
        where: { officeInventoryEntryId },
        data: {
          currentStock: { decrement: quantity },
          status: newStatus,
        },
        include: this.officeEntryInclude,
      });

      await tx.inventoryMovement.create({
        data: {
          officeInventoryEntryId,
          elementId: entry.elementId,
          movementType: InventoryMovementType.maintenance_out,
          fromLocation: InventoryLocation.office,
          toLocation: InventoryLocation.external,
          quantity,
          performedByUserId: dto.performedByUserId,
          notes: dto.notes?.trim() || 'Enviado a mantenimiento.',
        },
      });

      return updated;
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Salida a mantenimiento registrada exitosamente.',
      data: this.mapOfficeInventoryEntry(updatedEntry),
    };
  }

  async registerMaintenanceReturn(
    officeInventoryEntryId: number,
    dto: RegisterMaintenanceDto,
  ) {
    const entry = await this.prismaService.officeInventoryEntry.findUnique({
      where: { officeInventoryEntryId },
      include: this.officeEntryInclude,
    });

    if (!entry) {
      throw new NotFoundException('Registro de inventario de oficina no encontrado.');
    }

    const profile = this.getInventoryProfile(entry.element);

    if (profile.usesUniqueInventory && entry.status !== OfficeInventoryStatus.in_maintenance) {
      throw new BadRequestException(
        'Este elemento no se encuentra en mantenimiento.',
      );
    }

    const quantity = this.normalizeQuantity(dto.quantity);

    const updatedEntry = await this.prismaService.$transaction(async (tx) => {
      const updated = await tx.officeInventoryEntry.update({
        where: { officeInventoryEntryId },
        data: {
          currentStock: { increment: quantity },
          status: OfficeInventoryStatus.available,
        },
        include: this.officeEntryInclude,
      });

      await tx.inventoryMovement.create({
        data: {
          officeInventoryEntryId,
          elementId: entry.elementId,
          movementType: InventoryMovementType.maintenance_return,
          fromLocation: InventoryLocation.external,
          toLocation: InventoryLocation.office,
          quantity,
          performedByUserId: dto.performedByUserId,
          notes: dto.notes?.trim() || 'Retorno de mantenimiento.',
        },
      });

      return updated;
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Retorno de mantenimiento registrado exitosamente.',
      data: this.mapOfficeInventoryEntry(updatedEntry),
    };
  }

  // ─── Adjustment ──────────────────────────────────────────────

  async registerOfficeAdjustment(
    officeInventoryEntryId: number,
    dto: RegisterAdjustmentDto,
  ) {
    const entry = await this.prismaService.officeInventoryEntry.findUnique({
      where: { officeInventoryEntryId },
      include: this.officeEntryInclude,
    });

    if (!entry) {
      throw new NotFoundException('Registro de inventario de oficina no encontrado.');
    }

    if (entry.status === OfficeInventoryStatus.disposed) {
      throw new BadRequestException(
        'No se puede ajustar un registro dado de baja.',
      );
    }

    const profile = this.getInventoryProfile(entry.element);

    if (profile.usesUniqueInventory) {
      throw new BadRequestException(
        'Este item se maneja como equipo unico. No se registran ajustes manuales de stock.',
      );
    }

    const oldStock = this.normalizeQuantity(entry.currentStock);
    const newStock = this.normalizeQuantity(dto.newQuantity);
    const difference = this.normalizeQuantity(newStock - oldStock);

    if (difference === 0) {
      throw new BadRequestException(
        'La nueva cantidad es igual a la actual. No se requiere ajuste.',
      );
    }

    const updatedEntry = await this.prismaService.$transaction(async (tx) => {
      const updated = await tx.officeInventoryEntry.update({
        where: { officeInventoryEntryId },
        data: {
          currentStock: newStock,
        },
        include: this.officeEntryInclude,
      });

      await tx.inventoryMovement.create({
        data: {
          officeInventoryEntryId,
          elementId: entry.elementId,
          movementType: InventoryMovementType.adjustment,
          fromLocation: InventoryLocation.office,
          toLocation: InventoryLocation.office,
          quantity: Math.abs(difference),
          performedByUserId: dto.performedByUserId,
          notes: `Ajuste (${oldStock} → ${newStock}): ${dto.reason}${dto.notes ? ` — ${dto.notes.trim()}` : ''}`,
        },
      });

      return updated;
    });

    return {
      statusCode: HttpStatus.OK,
      message: `Ajuste registrado exitosamente (${oldStock} → ${newStock}).`,
      data: this.mapOfficeInventoryEntry(updatedEntry),
    };
  }

  // ─── Transfer Between Projects ───────────────────────────────

  async registerTransferBetweenProjects(
    sourceProjectInventoryEntryId: number,
    dto: RegisterTransferDto,
  ) {
    const sourceEntry =
      await this.prismaService.projectInventoryEntry.findUnique({
        where: { projectInventoryEntryId: sourceProjectInventoryEntryId },
        include: this.projectEntryInclude,
      });

    if (!sourceEntry) {
      throw new NotFoundException('Registro de inventario de origen no encontrado.');
    }

    const targetProject = await this.prismaService.project.findFirst({
      where: { projectId: dto.targetProjectId, deletedAt: null },
    });

    if (!targetProject) {
      throw new NotFoundException('Proyecto destino no encontrado.');
    }

    if (sourceEntry.projectId === dto.targetProjectId) {
      throw new BadRequestException(
        'El proyecto destino no puede ser el mismo que el origen.',
      );
    }

    const quantityPending = this.normalizeQuantity(
      this.normalizeQuantity(sourceEntry.quantityReceived) -
        this.normalizeQuantity(sourceEntry.quantityReturned),
    );
    const quantityToTransfer = this.normalizeQuantity(dto.quantity);

    if (quantityToTransfer > quantityPending) {
      throw new BadRequestException(
        `Solo puedes transferir hasta ${quantityPending} unidad(es) disponibles en el proyecto origen.`,
      );
    }

    const result = await this.prismaService.$transaction(async (tx) => {
      // Decrement source entry (mark as returned)
      await tx.projectInventoryEntry.update({
        where: { projectInventoryEntryId: sourceProjectInventoryEntryId },
        data: {
          quantityReturned: { increment: quantityToTransfer },
        },
      });

      // Create target entry — without tying to a specific elementRequest
      // We find or create a new ProjectInventoryEntry for the target project
      const targetEntry = await tx.projectInventoryEntry.create({
        data: {
          projectId: dto.targetProjectId,
          elementId: sourceEntry.elementId,
          elementVariantId: sourceEntry.elementVariantId ?? null,
          requestId: sourceEntry.requestId,
          elementRequestId: sourceEntry.elementRequestId,
          responsibleUserId: dto.responsibleUserId,
          unit: sourceEntry.unit,
          quantityReceived: quantityToTransfer,
          quantityReturned: 0,
          notes: `Transferido desde proyecto ${sourceEntry.project.name}.`,
        },
        include: this.projectEntryInclude,
      });

      // Create movement record
      await tx.inventoryMovement.create({
        data: {
          projectInventoryEntryId: sourceProjectInventoryEntryId,
          projectId: sourceEntry.projectId,
          elementId: sourceEntry.elementId,
          elementVariantId: sourceEntry.elementVariantId ?? null,
          movementType: InventoryMovementType.transfer_between_projects,
          fromLocation: InventoryLocation.project,
          toLocation: InventoryLocation.project,
          quantity: quantityToTransfer,
          performedByUserId: dto.performedByUserId,
          responsibleUserId: dto.responsibleUserId,
          notes:
            dto.notes?.trim() ||
            `Transferencia de ${sourceEntry.project.name} a ${targetProject.name}.`,
        },
      });

      return { sourceEntry, targetEntry };
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Transferencia entre proyectos registrada exitosamente.',
      data: {
        source: this.mapInventoryEntry({
          ...sourceEntry,
          quantityReturned:
            this.normalizeQuantity(sourceEntry.quantityReturned) +
            quantityToTransfer,
        }),
        target: this.mapInventoryEntry(result.targetEntry),
      },
    };
  }

  // ─── Global Movements Log ────────────────────────────────────

  async findAllMovements(query: FindMovementsQueryDto) {
    const where: any = {};

    if (query.movementType) {
      where.movementType = query.movementType;
    }
    if (query.elementId) {
      where.elementId = query.elementId;
    }
    if (query.projectId) {
      where.projectId = query.projectId;
    }
    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) {
        where.createdAt.gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        where.createdAt.lte = new Date(query.toDate + 'T23:59:59.999Z');
      }
    }

    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;

    const [movements, total] = await Promise.all([
      this.prismaService.inventoryMovement.findMany({
        where,
        include: this.movementInclude,
        orderBy: [{ createdAt: 'desc' }, { inventoryMovementId: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prismaService.inventoryMovement.count({ where }),
    ]);

    return {
      statusCode: HttpStatus.OK,
      message: 'Movimientos de inventario obtenidos exitosamente.',
      data: {
        total,
        limit,
        offset,
        movements: movements.map((m) => this.mapMovement(m)),
      },
    };
  }

  // ─── Existing: Receive Request Into Project Inventory ────────

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
          orderBy: [{ lineItemOrder: 'asc' }, { elementRequestId: 'asc' }],
          include: {
            element: {
              include: {
                category: true,
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
            },
          },
        responses: {
          include: {
            elementRequestResponses: {
              orderBy: [
                { updatedAt: 'desc' as const },
                { elementRequestResponseId: 'desc' as const },
              ],
            },
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
    const selectedElementIdsByElementRequestId = new Map<number, number[]>();

    for (const responseLine of requestResponse?.elementRequestResponses ?? []) {
      if (acceptedByElementRequestId.has(responseLine.elementRequestId)) {
        continue;
      }

      acceptedByElementRequestId.set(
        responseLine.elementRequestId,
        this.normalizeQuantity(responseLine.quantityAccepted),
      );
      selectedElementIdsByElementRequestId.set(
        responseLine.elementRequestId,
        ((responseLine as any).selectedElementIds || []).map(Number),
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
        const profile = this.getInventoryProfile(elementRequest.element);
        const selectedElementIds =
          selectedElementIdsByElementRequestId.get(
            elementRequest.elementRequestId,
          ) || [];
        const quantityReceived =
          acceptedByElementRequestId.get(elementRequest.elementRequestId) ??
          (profile.usesUniqueInventory
            ? 1
            : this.normalizeQuantity(elementRequest.quantityRequested));
        const receivedUnit =
          profile.family === ElementFamily.SsomaSupply
            ? 'unidad'
            : elementRequest.unit;

        if (quantityReceived <= 0) {
          continue;
        }

        if (
          this.isSafetyRequestLine(elementRequest.element) &&
          selectedElementIds.length
        ) {
          for (const selectedElementId of selectedElementIds) {
            const selectedElement = await tx.element.findUnique({
              where: { elementId: selectedElementId },
              include: { category: true },
            });

            if (!selectedElement) {
              throw new BadRequestException(
                'Uno de los equipos seleccionados para ESE no existe.',
              );
            }

            const officeEntry = await tx.officeInventoryEntry.findFirst({
              where: {
                elementId: selectedElementId,
                status: OfficeInventoryStatus.available,
                currentStock: { gt: 0 },
              },
              orderBy: [
                { updatedAt: 'desc' },
                { officeInventoryEntryId: 'desc' },
              ],
            });

            if (!officeEntry) {
              throw new BadRequestException(
                `El equipo ${selectedElement.name}${selectedElement.code ? ` - ${selectedElement.code}` : ''} ya no tiene stock disponible en oficina.`,
              );
            }

            const createdEntry = await tx.projectInventoryEntry.create({
              data: {
                projectId: request.projectId,
                elementId: selectedElementId,
                elementVariantId: null,
                fallProtectionGroupId: null,
                requestId: request.requestId,
                requestResponseId: requestResponse?.requestResponseId ?? null,
                elementRequestId: elementRequest.elementRequestId,
                responsibleUserId: request.userId,
                unit: elementRequest.unit,
                quantityReceived: 1,
                quantityReturned: 0,
                notes: (elementRequest as any).notes ?? request.description,
              },
              include: this.projectEntryInclude,
            });

            await tx.inventoryMovement.create({
              data: {
                projectInventoryEntryId: createdEntry.projectInventoryEntryId,
                officeInventoryEntryId: officeEntry.officeInventoryEntryId,
                projectId: request.projectId,
                elementId: selectedElementId,
                elementVariantId: null,
                requestId: request.requestId,
                movementType: InventoryMovementType.request_received,
                fromLocation: InventoryLocation.office,
                toLocation: InventoryLocation.project,
                quantity: 1,
                performedByUserId: completedByUserId,
                responsibleUserId: request.userId,
                notes:
                  'Ingreso automatico por seleccion de equipo ESE en requerimiento.',
              },
            });

            await tx.officeInventoryEntry.update({
              where: {
                officeInventoryEntryId: officeEntry.officeInventoryEntryId,
              },
              data: {
                currentStock: { decrement: 1 },
              },
            });

            createdEntries.push(createdEntry);
          }

          continue;
        }

        const createdEntry = await tx.projectInventoryEntry.create({
          data: {
              projectId: request.projectId,
              elementId: elementRequest.elementId,
              elementVariantId: elementRequest.elementVariantId ?? null,
              fallProtectionGroupId: elementRequest.fallProtectionGroupId ?? null,
              requestId: request.requestId,
            requestResponseId: requestResponse?.requestResponseId ?? null,
            elementRequestId: elementRequest.elementRequestId,
            responsibleUserId: request.userId,
            unit: receivedUnit,
            quantityReceived,
            quantityReturned: 0,
            notes: (elementRequest as any).notes ?? request.description,
          },
          include: this.projectEntryInclude,
        });

        // Optionally decrement office stock (informational, does NOT block)
        const directOfficeEntry = await tx.officeInventoryEntry.findFirst({
          where: {
            elementId: elementRequest.elementId,
            status: OfficeInventoryStatus.available,
            elementVariantId: elementRequest.elementVariantId ?? null,
          },
          orderBy: [{ updatedAt: 'desc' }, { officeInventoryEntryId: 'desc' }],
        });
        const officeEntry =
          directOfficeEntry ||
          (elementRequest.elementVariantId
            ? await tx.officeInventoryEntry.findFirst({
                where: {
                  elementId: elementRequest.elementId,
                  elementVariantId: null,
                  status: OfficeInventoryStatus.available,
                },
                orderBy: [
                  { updatedAt: 'desc' },
                  { officeInventoryEntryId: 'desc' },
                ],
              })
            : null);

        await tx.inventoryMovement.create({
          data: {
            projectInventoryEntryId: createdEntry.projectInventoryEntryId,
            officeInventoryEntryId: officeEntry?.officeInventoryEntryId ?? null,
            projectId: request.projectId,
            elementId: elementRequest.elementId,
            elementVariantId: elementRequest.elementVariantId ?? null,
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

        // Decrement office stock if entry exists (stock can go negative — informational only)
        if (officeEntry) {
          await tx.officeInventoryEntry.update({
            where: { officeInventoryEntryId: officeEntry.officeInventoryEntryId },
            data: {
              currentStock: { decrement: quantityReceived },
            },
          });
        }

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

  // ─── Existing: Project Inventory ─────────────────────────────

  async findProjectInventory(projectId: number) {
    const project = await this.prismaService.project.findFirst({
      where: { projectId, deletedAt: null },
    });

    if (!project) {
      throw new NotFoundException('No se encontro el proyecto.');
    }

    const [entries, fallProtectionGroups] = await Promise.all([
      this.prismaService.projectInventoryEntry.findMany({
        where: { projectId },
        include: this.projectEntryInclude,
        orderBy: [{ createdAt: 'desc' }, { projectInventoryEntryId: 'desc' }],
      }),
      this.prismaService.fallProtectionGroup.findMany({
        where: { deletedAt: null },
        include: {
          harnessElement: { include: { category: true } },
          anchorBandElement: { include: { category: true } },
          lifelineElement: { include: { category: true } },
          positioningLanyardElement: { include: { category: true } },
        },
      }),
    ]);

    const groupByPartElementId =
      this.mapFallProtectionGroupsByPart(fallProtectionGroups);
    const mappedEntries = this.aggregateProjectInventoryEntries(
      entries
        .map((entry) =>
          this.normalizeProjectEntryFallProtectionGroup(
            entry,
            groupByPartElementId,
          ),
        )
        .map((entry) => this.mapInventoryEntry(entry)),
    );
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
            (total, entry) => total + entry.quantityRequiredForProjectClosure,
            0,
          ),
          pendingBlockingEntries: blockers.length,
        },
        entries: mappedEntries,
      },
    };
  }

  async getProjectInactivationBlockers(projectId: number) {
    const [entries, fallProtectionGroups] = await Promise.all([
      this.prismaService.projectInventoryEntry.findMany({
      where: {
        projectId,
      },
      include: this.projectEntryInclude,
      }),
      this.prismaService.fallProtectionGroup.findMany({
        where: { deletedAt: null },
        include: {
          harnessElement: { include: { category: true } },
          anchorBandElement: { include: { category: true } },
          lifelineElement: { include: { category: true } },
          positioningLanyardElement: { include: { category: true } },
        },
      }),
    ]);

    const groupByPartElementId =
      this.mapFallProtectionGroupsByPart(fallProtectionGroups);

    return this.aggregateProjectInventoryEntries(
      entries
        .map((entry) =>
          this.normalizeProjectEntryFallProtectionGroup(
            entry,
            groupByPartElementId,
          ),
        )
        .map((entry) => this.mapInventoryEntry(entry)),
    )
      .filter((entry) => entry.blocksProjectInactivation);
  }

  async findProjectInactivationBlockers(projectId: number) {
    const blockers = await this.getProjectInactivationBlockers(projectId);

    return {
      statusCode: HttpStatus.OK,
      message: blockers.length
        ? 'El proyecto tiene elementos pendientes de retorno.'
        : 'El proyecto no tiene elementos pendientes de retorno.',
      data: blockers,
    };
  }

  // ─── Existing: Project Return (updated to increment office stock) ──

  async registerProjectReturn(
    projectInventoryEntryId: number,
    registerProjectReturnDto: RegisterProjectReturnDto,
    ) {
    const { sourceEntry: entry, entries, isFallProtectionGroup } =
      await this.findRelatedProjectInventoryEntries(projectInventoryEntryId);

    const profile = entry.fallProtectionGroupId
      ? {
          family: ElementFamily.Harness,
          returnsToOffice: true,
        }
      : this.getInventoryProfile(entry.element);

    if (!profile.returnsToOffice) {
      throw new BadRequestException(
        'Este elemento no requiere retorno a oficina.',
      );
    }

    const returnableEntries = entries
      .filter((item) => this.getProjectEntryReturnsToOffice(item))
      .map((item) => ({
        entry: item,
        available: this.getProjectEntryAvailableInProject(item),
      }))
      .filter((item) => item.available > 0);
    const availableToReturn = this.normalizeQuantity(
      isFallProtectionGroup
        ? Math.min(
            1,
            returnableEntries.reduce((total, item) => total + item.available, 0),
          )
        : returnableEntries.reduce((total, item) => total + item.available, 0),
    );
    const quantityToReturn = this.normalizeQuantity(
      registerProjectReturnDto.quantity,
    );

    if (quantityToReturn > availableToReturn) {
      throw new BadRequestException(
        `Solo puedes retornar ${availableToReturn} unidad(es) disponibles en obra. Lo asignado a trabajadores debe gestionarse desde su asignacion.`,
      );
    }

    const updatedEntry = await this.prismaService.$transaction(async (tx) => {
      let remaining = quantityToReturn;
      let firstUpdatedEntry: any = null;

      for (const availableItem of returnableEntries) {
        if (remaining <= 0) break;
        if (availableItem.available <= 0) continue;

        const quantity = this.normalizeQuantity(
          Math.min(remaining, availableItem.available),
        );
        const source = availableItem.entry;
        const nextEntry = await tx.projectInventoryEntry.update({
          where: {
            projectInventoryEntryId: source.projectInventoryEntryId,
          },
          data: {
            quantityReturned: {
              increment: quantity,
            },
            notes:
              registerProjectReturnDto.notes?.trim() ||
              source.notes ||
              undefined,
          },
          include: this.projectEntryInclude,
        });

        const existingOfficeEntry = await tx.officeInventoryEntry.findFirst({
          where: {
            elementId: source.elementId,
            elementVariantId: source.elementVariantId ?? null,
            status: { not: OfficeInventoryStatus.disposed },
          },
          orderBy: [{ updatedAt: 'desc' }, { officeInventoryEntryId: 'desc' }],
        });
        const officeEntry = existingOfficeEntry
          ? await tx.officeInventoryEntry.update({
              where: {
                officeInventoryEntryId:
                  existingOfficeEntry.officeInventoryEntryId,
              },
              data: {
                currentStock: { increment: quantity },
              },
            })
          : await tx.officeInventoryEntry.create({
              data: {
                elementId: source.elementId,
                elementVariantId: source.elementVariantId ?? null,
                unit: source.unit || 'unidad',
                currentStock: quantity,
                notes: 'Stock creado automaticamente por retorno de obra.',
              },
            });

        await tx.inventoryMovement.create({
          data: {
            projectInventoryEntryId: source.projectInventoryEntryId,
            officeInventoryEntryId: officeEntry.officeInventoryEntryId,
            projectId: source.projectId,
            elementId: source.elementId,
            elementVariantId: source.elementVariantId ?? null,
            requestId: source.requestId,
            movementType: InventoryMovementType.returned_to_office,
            fromLocation: InventoryLocation.project,
            toLocation: InventoryLocation.office,
            quantity,
            performedByUserId: registerProjectReturnDto.performedByUserId,
            responsibleUserId: source.responsibleUserId,
            notes:
              registerProjectReturnDto.notes?.trim() ||
              'Retorno registrado desde inventario de obra.',
          },
        });

        firstUpdatedEntry = firstUpdatedEntry ?? nextEntry;
        remaining = this.normalizeQuantity(remaining - quantity);
      }

      if (!firstUpdatedEntry) {
        return tx.projectInventoryEntry.findUnique({
          where: { projectInventoryEntryId },
          include: this.projectEntryInclude,
        });
      }

      return firstUpdatedEntry;
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Retorno registrado exitosamente.',
      data: this.mapInventoryEntry(updatedEntry),
    };
  }

  // ─── Existing: Element Inventory Detail ──────────────────────

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
      include: this.projectEntryInclude,
      orderBy: [{ createdAt: 'desc' }, { projectInventoryEntryId: 'desc' }],
    });

    const officeEntries = await this.prismaService.officeInventoryEntry.findMany({
      where: { elementId },
      include: this.officeEntryInclude,
      orderBy: [{ updatedAt: 'desc' }],
    });

    const movements = await this.prismaService.inventoryMovement.findMany({
      where: { elementId },
      include: this.movementInclude,
      orderBy: [{ createdAt: 'desc' }, { inventoryMovementId: 'desc' }],
    });

    const mappedEntries = entries.map((entry) => this.mapInventoryEntry(entry));
    const mappedOfficeEntries = officeEntries.map((entry) =>
      this.mapOfficeInventoryEntry(entry),
    );
    const currentLocations = mappedEntries.filter(
      (entry) => entry.quantityPending > 0,
    );

    const totalOfficeStock = mappedOfficeEntries.reduce(
      (total, entry) => total + entry.currentStock,
      0,
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
          totalOfficeStock,
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
        officeEntries: mappedOfficeEntries,
        currentLocations,
        movementHistory: movements.map((movement) => this.mapMovement(movement)),
      },
    };
  }
}
