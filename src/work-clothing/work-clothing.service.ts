import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ElementFamily,
  InventoryLocation,
  InventoryMovementType,
  Prisma,
  WorkClothingDeliveryStatus,
  WorkClothingDispatchStatus,
  WorkClothingReturnStatus,
} from 'src/generated/prisma';
import { buildPaginatedData, getPaginationArgs } from 'src/common/pagination';
import { PermissionsService } from 'src/permissions/permissions.service';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AnnulDeliveryDto,
  CancelReturnDto,
  CreateDeliveryDto,
  CreateDispatchDto,
  CreateReturnDto,
  ListWorkClothingQueryDto,
  ReceiveDispatchDto,
} from './dto/work-clothing.dto';

const decimal = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
const number = (value: Prisma.Decimal.Value | null | undefined) =>
  value == null ? 0 : Number(value);

@Injectable()
export class WorkClothingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  async listCentralStock(search?: string) {
    const term = search?.trim();
    const items = await this.prisma.officeInventoryEntry.findMany({
      where: {
        status: 'available',
        elementVariantId: { not: null },
        element: {
          family: ElementFamily.uniform,
          deletedAt: null,
          ...(term
            ? {
                OR: [
                  { name: { contains: term, mode: 'insensitive' } },
                  { code: { contains: term, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        elementVariant: { deletedAt: null },
      },
      include: { element: true, elementVariant: true },
      orderBy: [
        { element: { name: 'asc' } },
        { elementVariant: { label: 'asc' } },
        { officeInventoryEntryId: 'asc' },
      ],
    });
    return this.ok(items, 'Stock central de ropa de trabajo recuperado.');
  }

  async listCustodians(search?: string) {
    const term = search?.trim();
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        userUserTypes: {
          some: {
            userType: {
              permissions: {
                hasSome: ['workClothing.receive', 'workClothing.manage'],
              },
            },
          },
        },
        ...(term
          ? {
              OR: [
                { name: { contains: term, mode: 'insensitive' } },
                { lastName: { contains: term, mode: 'insensitive' } },
                { email: { contains: term, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: { userId: true, name: true, lastName: true, email: true },
      orderBy: [{ name: 'asc' }, { lastName: 'asc' }],
    });
    return this.ok(users, 'Responsables de custodia recuperados.');
  }

  async getRequestFulfillment(requestId: number) {
    const request = await this.prisma.request.findFirst({
      where: { requestId, ssomaRequestKind: { not: null } },
      include: {
        project: true,
        elementRequests: {
          where: { element: { family: ElementFamily.uniform } },
          include: {
            element: true,
            elementVariant: true,
            workClothingDispatchItems: true,
          },
          orderBy: [{ lineItemOrder: 'asc' }, { elementRequestId: 'asc' }],
        },
      },
    });
    if (!request)
      throw new NotFoundException('Requerimiento SSOMA no encontrado.');
    return this.ok(
      {
        requestId: request.requestId,
        project: request.project,
        lines: request.elementRequests.map((line) => {
          const requested = number(line.quantityRequested);
          const dispatched = line.workClothingDispatchItems.reduce(
            (sum, item) => sum + number(item.quantityDispatched),
            0,
          );
          return {
            elementRequestId: line.elementRequestId,
            elementId: line.elementId,
            elementVariantId: line.elementVariantId,
            elementName: line.element.name,
            variantLabel: line.elementVariant?.label ?? 'Sin talla',
            quantityRequested: requested,
            quantityDispatched: dispatched,
            quantityPending: Math.max(0, requested - dispatched),
          };
        }),
      },
      'Avance de atención recuperado.',
    );
  }

  async listDispatches(query: ListWorkClothingQueryDto, actorUserId: number) {
    const permissions = await this.permissions.forUser(actorUserId);
    const mayViewAll = permissions.includes('workClothing.manage');
    if (
      query.custodianUserId &&
      !mayViewAll &&
      query.custodianUserId !== actorUserId
    ) {
      throw new BadRequestException(
        'No puede consultar la custodia de otro responsable.',
      );
    }
    const search = query.search?.trim();
    const where: Prisma.WorkClothingDispatchWhereInput = {
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.custodianUserId
        ? { custodianUserId: query.custodianUserId }
        : mayViewAll
          ? {}
          : { custodianUserId: actorUserId }),
      ...(search
        ? {
            OR: [
              { project: { name: { contains: search, mode: 'insensitive' } } },
              {
                custodianUser: {
                  name: { contains: search, mode: 'insensitive' },
                },
              },
              {
                custodianUser: {
                  lastName: { contains: search, mode: 'insensitive' },
                },
              },
              {
                items: {
                  some: {
                    elementNameSnapshot: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const { skip, take } = getPaginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.workClothingDispatch.findMany({
        where,
        include: {
          project: true,
          custodianUser: {
            select: { userId: true, name: true, lastName: true },
          },
          dispatchedByUser: {
            select: { userId: true, name: true, lastName: true },
          },
          request: { select: { requestId: true, ssomaRequestKind: true } },
          items: { include: { element: true, elementVariant: true } },
        },
        orderBy: [{ dispatchedAt: 'desc' }, { workClothingDispatchId: 'desc' }],
        skip,
        take,
      }),
      this.prisma.workClothingDispatch.count({ where }),
    ]);
    return this.ok(
      buildPaginatedData(items, total, query),
      'Despachos recuperados.',
    );
  }

  async createDispatch(dto: CreateDispatchDto, actorUserId: number) {
    const previous = await this.prisma.workClothingDispatch.findUnique({
      where: { clientRequestId: dto.clientRequestId },
      include: { items: true },
    });
    if (previous)
      return this.ok(previous, 'El despacho ya había sido registrado.');

    return this.serializable(async (tx) => {
      await this.assertProjectAndCustodian(
        tx,
        dto.projectId,
        dto.custodianUserId,
      );
      if (dto.requestId) {
        const request = await tx.request.findFirst({
          where: {
            requestId: dto.requestId,
            projectId: dto.projectId,
            ssomaRequestKind: { not: null },
          },
        });
        if (!request) {
          throw new BadRequestException(
            'El requerimiento SSOMA no pertenece al proyecto.',
          );
        }
      }

      const dispatch = await tx.workClothingDispatch.create({
        data: {
          clientRequestId: dto.clientRequestId,
          projectId: dto.projectId,
          custodianUserId: dto.custodianUserId,
          requestId: dto.requestId,
          dispatchedByUserId: actorUserId,
          dispatchedAt: new Date(dto.dispatchedAt),
          observations: dto.observations,
        },
      });

      for (const line of dto.items) {
        const office = await tx.officeInventoryEntry.findFirst({
          where: {
            officeInventoryEntryId: line.officeInventoryEntryId,
            status: 'available',
            elementVariantId: { not: null },
            element: { family: ElementFamily.uniform, deletedAt: null },
            elementVariant: { deletedAt: null },
          },
          include: { element: true, elementVariant: true },
        });
        if (!office?.elementVariant) {
          throw new BadRequestException(
            'Una prenda o talla seleccionada no es válida.',
          );
        }
        if (office.elementVariant.elementId !== office.elementId) {
          throw new BadRequestException(
            'La talla seleccionada no pertenece a la prenda indicada.',
          );
        }
        const elementVariantId = office.elementVariantId as number;
        if (line.elementRequestId) {
          const requestLine = await tx.elementRequest.findFirst({
            where: {
              elementRequestId: line.elementRequestId,
              requestId: dto.requestId,
              elementId: office.elementId,
              elementVariantId,
            },
          });
          if (!requestLine) {
            throw new BadRequestException(
              'La línea no corresponde al requerimiento y talla indicados.',
            );
          }
        }
        const quantity = decimal(line.quantity);
        const updated = await tx.officeInventoryEntry.updateMany({
          where: {
            officeInventoryEntryId: office.officeInventoryEntryId,
            currentStock: { gte: quantity },
          },
          data: { currentStock: { decrement: quantity } },
        });
        if (updated.count !== 1) {
          throw new ConflictException(
            `Stock insuficiente para ${office.element.name} - ${office.elementVariant.label}.`,
          );
        }
        const item = await tx.workClothingDispatchItem.create({
          data: {
            workClothingDispatchId: dispatch.workClothingDispatchId,
            officeInventoryEntryId: office.officeInventoryEntryId,
            elementId: office.elementId,
            elementVariantId,
            elementRequestId: line.elementRequestId,
            elementNameSnapshot: office.element.name,
            variantLabelSnapshot: office.elementVariant.label,
            quantityDispatched: quantity,
          },
        });
        await tx.inventoryMovement.create({
          data: {
            officeInventoryEntryId: office.officeInventoryEntryId,
            projectId: dto.projectId,
            elementId: office.elementId,
            elementVariantId,
            requestId: dto.requestId,
            movementType: InventoryMovementType.work_clothing_dispatch,
            fromLocation: InventoryLocation.office,
            toLocation: InventoryLocation.external,
            quantity,
            performedByUserId: actorUserId,
            responsibleUserId: dto.custodianUserId,
            workClothingDispatchItemId: item.workClothingDispatchItemId,
            notes: dto.observations,
          },
        });
      }
      const result = await tx.workClothingDispatch.findUnique({
        where: { workClothingDispatchId: dispatch.workClothingDispatchId },
        include: { project: true, custodianUser: true, items: true },
      });
      return this.created(
        result,
        'Despacho registrado; las prendas están en tránsito.',
      );
    });
  }

  async receiveDispatch(
    dispatchId: number,
    dto: ReceiveDispatchDto,
    actorUserId: number,
  ) {
    return this.serializable(async (tx) => {
      const dispatch = await tx.workClothingDispatch.findUnique({
        where: { workClothingDispatchId: dispatchId },
        include: { items: true },
      });
      if (!dispatch) throw new NotFoundException('Despacho no encontrado.');
      await this.assertCustodianOrManager(
        actorUserId,
        dispatch.custodianUserId,
      );
      if (dispatch.status !== WorkClothingDispatchStatus.inTransit) {
        throw new ConflictException(
          'El despacho ya fue confirmado o tiene una discrepancia registrada.',
        );
      }
      const receivedById = new Map(
        dto.items.map((item) => [
          item.dispatchItemId,
          decimal(item.quantityReceived),
        ]),
      );
      if (receivedById.size !== dispatch.items.length) {
        throw new BadRequestException(
          'Debe confirmar la cantidad recibida de todas las líneas.',
        );
      }
      let exact = true;
      for (const item of dispatch.items) {
        const received = receivedById.get(item.workClothingDispatchItemId);
        if (!received)
          throw new BadRequestException(
            'La recepción contiene una línea inválida.',
          );
        if (received.greaterThan(item.quantityDispatched)) {
          throw new BadRequestException(
            'La cantidad recibida no puede superar la cantidad despachada.',
          );
        }
        if (!received.equals(item.quantityDispatched)) exact = false;
        await tx.workClothingDispatchItem.update({
          where: {
            workClothingDispatchItemId: item.workClothingDispatchItemId,
          },
          data: { quantityReceived: received },
        });
      }
      if (!exact) {
        if (!dto.discrepancyNotes?.trim()) {
          throw new BadRequestException('Describa la discrepancia encontrada.');
        }
        const result = await tx.workClothingDispatch.update({
          where: { workClothingDispatchId: dispatchId },
          data: {
            status: WorkClothingDispatchStatus.discrepancy,
            receivedByUserId: actorUserId,
            receivedAt: new Date(),
            discrepancyNotes: dto.discrepancyNotes.trim(),
          },
          include: { items: true },
        });
        return this.ok(
          result,
          'Discrepancia registrada; el saldo no fue incorporado a custodia.',
        );
      }
      for (const item of dispatch.items) {
        await tx.workClothingCustodyBalance.upsert({
          where: {
            projectId_custodianUserId_elementId_elementVariantId: {
              projectId: dispatch.projectId,
              custodianUserId: dispatch.custodianUserId,
              elementId: item.elementId,
              elementVariantId: item.elementVariantId,
            },
          },
          create: {
            projectId: dispatch.projectId,
            custodianUserId: dispatch.custodianUserId,
            elementId: item.elementId,
            elementVariantId: item.elementVariantId,
            quantityReceived: item.quantityDispatched,
          },
          update: { quantityReceived: { increment: item.quantityDispatched } },
        });
      }
      const result = await tx.workClothingDispatch.update({
        where: { workClothingDispatchId: dispatchId },
        data: {
          status: WorkClothingDispatchStatus.received,
          receivedByUserId: actorUserId,
          receivedAt: new Date(),
          discrepancyNotes: null,
        },
        include: { items: true },
      });
      return this.ok(result, 'Despacho recibido e incorporado a la custodia.');
    });
  }

  async listCustody(query: ListWorkClothingQueryDto, actorUserId: number) {
    const permissions = await this.permissions.forUser(actorUserId);
    const mayViewAll = permissions.includes('workClothing.manage');
    if (
      query.custodianUserId &&
      !mayViewAll &&
      query.custodianUserId !== actorUserId
    ) {
      throw new BadRequestException(
        'No puede consultar la custodia de otro responsable.',
      );
    }
    const where: Prisma.WorkClothingCustodyBalanceWhereInput = {
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.custodianUserId
        ? { custodianUserId: query.custodianUserId }
        : mayViewAll
          ? {}
          : { custodianUserId: actorUserId }),
      ...(query.search?.trim()
        ? {
            element: {
              name: { contains: query.search.trim(), mode: 'insensitive' },
            },
          }
        : {}),
    };
    const items = await this.prisma.workClothingCustodyBalance.findMany({
      where,
      include: {
        project: true,
        custodianUser: true,
        element: true,
        elementVariant: true,
      },
      orderBy: [{ project: { name: 'asc' } }, { element: { name: 'asc' } }],
    });
    return this.ok(
      items.map((item) => ({
        ...item,
        quantityAvailable:
          number(item.quantityReceived) -
          number(item.quantityDelivered) -
          number(item.quantityReturnInTransit) -
          number(item.quantityReturned),
      })),
      'Saldos de custodia recuperados.',
    );
  }

  async createDelivery(dto: CreateDeliveryDto, actorUserId: number) {
    const previous = await this.prisma.workClothingDelivery.findUnique({
      where: { clientRequestId: dto.clientRequestId },
      include: { items: true },
    });
    if (previous)
      return this.ok(previous, 'La entrega ya había sido registrada.');
    await this.assertCustodianOrManager(actorUserId, dto.custodianUserId);
    return this.serializable(async (tx) => {
      const worker = await tx.worker.findFirst({
        where: { workerId: dto.workerId, deletedAt: null },
      });
      if (!worker) throw new NotFoundException('Trabajador no encontrado.');
      const delivery = await tx.workClothingDelivery.create({
        data: {
          clientRequestId: dto.clientRequestId,
          projectId: dto.projectId,
          custodianUserId: dto.custodianUserId,
          workerId: dto.workerId,
          deliveredByUserId: actorUserId,
          deliveredAt: new Date(dto.deliveredAt),
          observations: dto.observations,
        },
      });
      for (const line of dto.items) {
        const balance = await tx.workClothingCustodyBalance.findFirst({
          where: {
            workClothingCustodyBalanceId: line.custodyBalanceId,
            projectId: dto.projectId,
            custodianUserId: dto.custodianUserId,
          },
          include: { element: true, elementVariant: true },
        });
        if (!balance)
          throw new BadRequestException(
            'El saldo seleccionado no pertenece a la custodia indicada.',
          );
        const available = decimal(balance.quantityReceived)
          .minus(balance.quantityDelivered)
          .minus(balance.quantityReturnInTransit)
          .minus(balance.quantityReturned);
        const quantity = decimal(line.quantity);
        if (available.lessThan(quantity)) {
          throw new ConflictException(
            `Saldo insuficiente para ${balance.element.name} - ${balance.elementVariant.label}.`,
          );
        }
        await tx.workClothingCustodyBalance.update({
          where: {
            workClothingCustodyBalanceId: balance.workClothingCustodyBalanceId,
          },
          data: { quantityDelivered: { increment: quantity } },
        });
        await tx.workClothingDeliveryItem.create({
          data: {
            workClothingDeliveryId: delivery.workClothingDeliveryId,
            elementId: balance.elementId,
            elementVariantId: balance.elementVariantId,
            elementNameSnapshot: balance.element.name,
            variantLabelSnapshot: balance.elementVariant.label,
            quantity,
          },
        });
      }
      const result = await tx.workClothingDelivery.findUnique({
        where: { workClothingDeliveryId: delivery.workClothingDeliveryId },
        include: {
          project: true,
          worker: true,
          custodianUser: true,
          items: true,
        },
      });
      return this.created(result, 'Entrega de ropa registrada.');
    });
  }

  async listDeliveries(query: ListWorkClothingQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.WorkClothingDeliveryWhereInput = {
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.custodianUserId
        ? { custodianUserId: query.custodianUserId }
        : {}),
      ...(query.workerId ? { workerId: query.workerId } : {}),
      ...(search
        ? {
            OR: [
              {
                worker: { fullName: { contains: search, mode: 'insensitive' } },
              },
              { worker: { dni: { contains: search, mode: 'insensitive' } } },
              { project: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const { skip, take } = getPaginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.workClothingDelivery.findMany({
        where,
        include: {
          project: true,
          worker: true,
          custodianUser: {
            select: { userId: true, name: true, lastName: true },
          },
          deliveredByUser: {
            select: { userId: true, name: true, lastName: true },
          },
          items: true,
        },
        orderBy: [{ deliveredAt: 'desc' }, { workClothingDeliveryId: 'desc' }],
        skip,
        take,
      }),
      this.prisma.workClothingDelivery.count({ where }),
    ]);
    return this.ok(
      buildPaginatedData(items, total, query),
      'Entregas recuperadas.',
    );
  }

  async listWorkerDeliveries(
    query: ListWorkClothingQueryDto,
    actorUserId: number,
  ) {
    const permissions = await this.permissions.forUser(actorUserId);
    if (!permissions.includes('workClothing.viewHistoryAll')) {
      query.custodianUserId = actorUserId;
    }
    return this.listDeliveries(query);
  }

  async getDelivery(deliveryId: number) {
    const delivery = await this.prisma.workClothingDelivery.findUnique({
      where: { workClothingDeliveryId: deliveryId },
      include: {
        project: true,
        worker: true,
        custodianUser: true,
        deliveredByUser: true,
        annulledByUser: true,
        items: true,
      },
    });
    if (!delivery) throw new NotFoundException('Entrega no encontrada.');
    return delivery;
  }

  async annulDelivery(
    deliveryId: number,
    dto: AnnulDeliveryDto,
    actorUserId: number,
  ) {
    return this.serializable(async (tx) => {
      const delivery = await tx.workClothingDelivery.findUnique({
        where: { workClothingDeliveryId: deliveryId },
        include: { items: true },
      });
      if (!delivery) throw new NotFoundException('Entrega no encontrada.');
      if (delivery.status !== WorkClothingDeliveryStatus.registered) {
        throw new ConflictException('La entrega ya fue anulada.');
      }
      for (const item of delivery.items) {
        const balance = await tx.workClothingCustodyBalance.findUnique({
          where: {
            projectId_custodianUserId_elementId_elementVariantId: {
              projectId: delivery.projectId,
              custodianUserId: delivery.custodianUserId,
              elementId: item.elementId,
              elementVariantId: item.elementVariantId,
            },
          },
        });
        if (
          !balance ||
          decimal(balance.quantityDelivered).lessThan(item.quantity)
        ) {
          throw new ConflictException(
            'No se puede reconstruir de forma consistente el saldo de la entrega.',
          );
        }
        await tx.workClothingCustodyBalance.update({
          where: {
            workClothingCustodyBalanceId: balance.workClothingCustodyBalanceId,
          },
          data: { quantityDelivered: { decrement: item.quantity } },
        });
      }
      const result = await tx.workClothingDelivery.update({
        where: { workClothingDeliveryId: deliveryId },
        data: {
          status: WorkClothingDeliveryStatus.annulled,
          annulledAt: new Date(),
          annulledByUserId: actorUserId,
          annulmentReason: dto.reason.trim(),
        },
        include: { items: true },
      });
      return this.ok(result, 'Entrega anulada y saldo restituido.');
    });
  }

  async createReturn(dto: CreateReturnDto, actorUserId: number) {
    const previous = await this.prisma.workClothingReturn.findUnique({
      where: { clientRequestId: dto.clientRequestId },
      include: { items: true },
    });
    if (previous)
      return this.ok(previous, 'La devolución ya había sido registrada.');
    await this.assertCustodianOrManager(actorUserId, dto.custodianUserId);
    return this.serializable(async (tx) => {
      const result = await tx.workClothingReturn.create({
        data: {
          clientRequestId: dto.clientRequestId,
          projectId: dto.projectId,
          custodianUserId: dto.custodianUserId,
          createdByUserId: actorUserId,
          returnedAt: new Date(dto.returnedAt),
          observations: dto.observations,
        },
      });
      for (const line of dto.items) {
        const balance = await tx.workClothingCustodyBalance.findFirst({
          where: {
            workClothingCustodyBalanceId: line.custodyBalanceId,
            projectId: dto.projectId,
            custodianUserId: dto.custodianUserId,
          },
          include: { element: true, elementVariant: true },
        });
        if (!balance)
          throw new BadRequestException(
            'El saldo seleccionado no pertenece a la custodia indicada.',
          );
        const available = decimal(balance.quantityReceived)
          .minus(balance.quantityDelivered)
          .minus(balance.quantityReturnInTransit)
          .minus(balance.quantityReturned);
        const quantity = decimal(line.quantity);
        if (available.lessThan(quantity))
          throw new ConflictException(
            'No existe saldo suficiente para devolver.',
          );
        await tx.workClothingCustodyBalance.update({
          where: {
            workClothingCustodyBalanceId: balance.workClothingCustodyBalanceId,
          },
          data: { quantityReturnInTransit: { increment: quantity } },
        });
        await tx.workClothingReturnItem.create({
          data: {
            workClothingReturnId: result.workClothingReturnId,
            elementId: balance.elementId,
            elementVariantId: balance.elementVariantId,
            elementNameSnapshot: balance.element.name,
            variantLabelSnapshot: balance.elementVariant.label,
            quantity,
          },
        });
      }
      const created = await tx.workClothingReturn.findUnique({
        where: { workClothingReturnId: result.workClothingReturnId },
        include: { project: true, custodianUser: true, items: true },
      });
      return this.created(
        created,
        'Devolución registrada en tránsito hacia Logística.',
      );
    });
  }

  async listReturns(query: ListWorkClothingQueryDto, actorUserId: number) {
    const permissions = await this.permissions.forUser(actorUserId);
    const mayViewAll = permissions.includes('workClothing.manage');
    if (
      query.custodianUserId &&
      !mayViewAll &&
      query.custodianUserId !== actorUserId
    ) {
      throw new BadRequestException(
        'No puede consultar la custodia de otro responsable.',
      );
    }
    const where: Prisma.WorkClothingReturnWhereInput = {
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.custodianUserId
        ? { custodianUserId: query.custodianUserId }
        : mayViewAll
          ? {}
          : { custodianUserId: actorUserId }),
    };
    const { skip, take } = getPaginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.workClothingReturn.findMany({
        where,
        include: { project: true, custodianUser: true, items: true },
        orderBy: [{ returnedAt: 'desc' }, { workClothingReturnId: 'desc' }],
        skip,
        take,
      }),
      this.prisma.workClothingReturn.count({ where }),
    ]);
    return this.ok(
      buildPaginatedData(items, total, query),
      'Devoluciones recuperadas.',
    );
  }

  async confirmReturn(returnId: number, actorUserId: number) {
    return this.serializable(async (tx) => {
      const workReturn = await tx.workClothingReturn.findUnique({
        where: { workClothingReturnId: returnId },
        include: { items: true },
      });
      if (!workReturn) throw new NotFoundException('Devolución no encontrada.');
      if (workReturn.status !== WorkClothingReturnStatus.pending) {
        throw new ConflictException('La devolución ya fue procesada.');
      }
      for (const item of workReturn.items) {
        const balance = await tx.workClothingCustodyBalance.findUnique({
          where: {
            projectId_custodianUserId_elementId_elementVariantId: {
              projectId: workReturn.projectId,
              custodianUserId: workReturn.custodianUserId,
              elementId: item.elementId,
              elementVariantId: item.elementVariantId,
            },
          },
        });
        if (
          !balance ||
          decimal(balance.quantityReturnInTransit).lessThan(item.quantity)
        ) {
          throw new ConflictException(
            'El saldo en tránsito no coincide con la devolución.',
          );
        }
        let office = await tx.officeInventoryEntry.findFirst({
          where: {
            elementId: item.elementId,
            elementVariantId: item.elementVariantId,
            status: 'available',
          },
          orderBy: { officeInventoryEntryId: 'asc' },
        });
        if (!office) {
          office = await tx.officeInventoryEntry.create({
            data: {
              elementId: item.elementId,
              elementVariantId: item.elementVariantId,
              unit: 'unidad',
              currentStock: 0,
            },
          });
        }
        await tx.officeInventoryEntry.update({
          where: { officeInventoryEntryId: office.officeInventoryEntryId },
          data: { currentStock: { increment: item.quantity } },
        });
        await tx.workClothingCustodyBalance.update({
          where: {
            workClothingCustodyBalanceId: balance.workClothingCustodyBalanceId,
          },
          data: {
            quantityReturnInTransit: { decrement: item.quantity },
            quantityReturned: { increment: item.quantity },
          },
        });
        const updatedItem = await tx.workClothingReturnItem.update({
          where: { workClothingReturnItemId: item.workClothingReturnItemId },
          data: { officeInventoryEntryId: office.officeInventoryEntryId },
        });
        await tx.inventoryMovement.create({
          data: {
            officeInventoryEntryId: office.officeInventoryEntryId,
            projectId: workReturn.projectId,
            elementId: item.elementId,
            elementVariantId: item.elementVariantId,
            movementType: InventoryMovementType.work_clothing_return,
            fromLocation: InventoryLocation.external,
            toLocation: InventoryLocation.office,
            quantity: item.quantity,
            performedByUserId: actorUserId,
            responsibleUserId: workReturn.custodianUserId,
            workClothingReturnItemId: updatedItem.workClothingReturnItemId,
          },
        });
      }
      const result = await tx.workClothingReturn.update({
        where: { workClothingReturnId: returnId },
        data: {
          status: WorkClothingReturnStatus.confirmed,
          confirmedAt: new Date(),
          confirmedByUserId: actorUserId,
        },
        include: { items: true },
      });
      return this.ok(
        result,
        'Recepción física confirmada y stock central actualizado.',
      );
    });
  }

  async cancelReturn(
    returnId: number,
    dto: CancelReturnDto,
    actorUserId: number,
  ) {
    return this.serializable(async (tx) => {
      const workReturn = await tx.workClothingReturn.findUnique({
        where: { workClothingReturnId: returnId },
        include: { items: true },
      });
      if (!workReturn) throw new NotFoundException('Devolución no encontrada.');
      await this.assertCustodianOrManager(
        actorUserId,
        workReturn.custodianUserId,
      );
      if (workReturn.status !== WorkClothingReturnStatus.pending) {
        throw new ConflictException(
          'Solo puede cancelarse una devolución pendiente.',
        );
      }
      for (const item of workReturn.items) {
        const balance = await tx.workClothingCustodyBalance.findUnique({
          where: {
            projectId_custodianUserId_elementId_elementVariantId: {
              projectId: workReturn.projectId,
              custodianUserId: workReturn.custodianUserId,
              elementId: item.elementId,
              elementVariantId: item.elementVariantId,
            },
          },
        });
        if (
          !balance ||
          decimal(balance.quantityReturnInTransit).lessThan(item.quantity)
        ) {
          throw new ConflictException(
            'No se puede restituir el saldo de la devolución.',
          );
        }
        await tx.workClothingCustodyBalance.update({
          where: {
            workClothingCustodyBalanceId: balance.workClothingCustodyBalanceId,
          },
          data: { quantityReturnInTransit: { decrement: item.quantity } },
        });
      }
      const result = await tx.workClothingReturn.update({
        where: { workClothingReturnId: returnId },
        data: {
          status: WorkClothingReturnStatus.cancelled,
          observations: [
            workReturn.observations,
            `Cancelada: ${dto.reason.trim()}`,
          ]
            .filter(Boolean)
            .join('\n'),
        },
        include: { items: true },
      });
      return this.ok(result, 'Devolución cancelada y saldo restituido.');
    });
  }

  private async assertProjectAndCustodian(
    tx: Prisma.TransactionClient,
    projectId: number,
    custodianUserId: number,
  ) {
    const [project, user] = await Promise.all([
      tx.project.findFirst({ where: { projectId, deletedAt: null } }),
      tx.user.findFirst({
        where: {
          userId: custodianUserId,
          deletedAt: null,
          userUserTypes: {
            some: {
              userType: {
                permissions: {
                  hasSome: ['workClothing.receive', 'workClothing.manage'],
                },
              },
            },
          },
        },
      }),
    ]);
    if (!project) throw new NotFoundException('Proyecto no encontrado.');
    if (!user) {
      throw new BadRequestException(
        'El responsable PDR no existe o no tiene permiso de recepción.',
      );
    }
  }

  private async assertCustodianOrManager(
    actorUserId: number,
    custodianUserId: number,
  ) {
    if (actorUserId === custodianUserId) return;
    const permissions = await this.permissions.forUser(actorUserId);
    if (!permissions.includes('workClothing.manage')) {
      throw new BadRequestException(
        'No puede operar la custodia de otro responsable.',
      );
    }
  }

  private async serializable<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    try {
      return await this.prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('La operación ya fue registrada.');
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'Otro usuario actualizó el saldo. Vuelva a intentarlo.',
        );
      }
      throw error;
    }
  }

  private ok<T>(data: T, message: string) {
    return { statusCode: HttpStatus.OK, message, data };
  }

  private created<T>(data: T, message: string) {
    return { statusCode: HttpStatus.CREATED, message, data };
  }
}
