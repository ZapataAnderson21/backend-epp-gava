import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { CreateCompletePurchaseOrderDto } from './dto/create-complete-purchase-order.dto';
import { Prisma } from 'src/generated/prisma';
import { createHash } from 'node:crypto';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Currency } from 'src/supplier/enum/currency.enum';
import {
  PurchaseOrderStatusLabelEs,
  PurchaseOrderStatus,
  PurchaseOrderType,
  PurchaseOrderTypeLabelEs,
} from './enum';
import { NotificationService } from 'src/notification/notification.service';
import { buildPaginatedData, getPaginationArgs } from 'src/common/pagination';
import { ListPurchaseOrdersQueryDto } from './dto/list-purchase-orders-query.dto';
import { PurchaseOrderDashboardQueryDto } from './dto/purchase-order-dashboard-query.dto';
import { PurchaseOrderSummaryQueryDto } from './dto/purchase-order-summary-query.dto';
import type {
  PurchaseOrderProjectSummary,
  PurchaseOrderSummaryAmount,
} from './types/purchase-order-summary';

@Injectable()
export class PurchaseOrderService {
  private readonly logger = new Logger('PurchaseOrderService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(dto: CreateCompletePurchaseOrderDto, userId: number) {
    const { creationKey, items, ...header } = dto;
    if (!creationKey || !Number.isInteger(userId))
      throw new BadRequestException('Actualice la página antes de guardar.');
    if (
      !items?.length ||
      new Set(items.map((item) => item.resourceId)).size !== items.length
    ) {
      throw new BadRequestException(
        'Agregue recursos y no repita el mismo recurso en varias filas.',
      );
    }
    const requestHash = createHash('sha256')
      .update(canonical({ header, items }))
      .digest('hex');
    const result = await this.prisma.$transaction(
      async (tx) => {
        // All creation paths share the lock; PostgreSQL releases it on commit/rollback.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(20260921, 1)`;
        const receipt = await tx.purchaseOrderCreation.findUnique({
          where: { userId_key: { userId, key: creationKey } },
        });
        if (receipt) {
          if (receipt.requestHash !== requestHash)
            throw new ConflictException(
              `Este intento ya guardó la orden con ID ${receipt.purchaseOrderId}. Revísela antes de guardar cambios.`,
            );
          const order = await tx.purchaseOrder.findUnique({
            where: { purchaseOrderId: receipt.purchaseOrderId },
            include: { project: true },
          });
          if (!order)
            throw new ConflictException(
              'La orden de este intento fue eliminada. Inicie una nueva orden; no se volverá a crear al reintentar.',
            );
          return { order, replayed: true };
        }
        if (
          !(await tx.project.findFirst({
            where: { projectId: header.projectId, deletedAt: null },
          }))
        )
          throw new BadRequestException('Proyecto no encontrado.');
        const code = await this.allocateCode(
          tx,
          header.code,
          header.supplierId,
        );
        const order = await tx.purchaseOrder.create({
          data: { ...header, code },
          include: { project: true },
        });
        const saved = order;
        await tx.resourcePurchaseOrder.createMany({
          data: items.map((item) => ({
            ...item,
            purchaseOrderId: saved.purchaseOrderId,
          })),
        });
        await tx.purchaseOrderCreation.create({
          data: {
            userId,
            key: creationKey,
            requestHash,
            purchaseOrderId: saved.purchaseOrderId,
          },
        });
        return { order: saved, replayed: false };
      },
      { maxWait: 15000, timeout: 30000 },
    );

    if (!result.replayed) {
      this.logger.log(
        `Generated code for purchase order: ${result.order.code}`,
      );
      this.logger.log(
        `Purchase order created successfully with id: ${result.order.purchaseOrderId}`,
      );
      try {
        await this.notificationService.notifyPurchaseOrderPending(
          result.order.purchaseOrderId,
          result.order.code,
          result.order.project.name,
          result.order.projectId,
        );
      } catch {
        this.logger.error(
          `La OC ${result.order.purchaseOrderId} se guardó, pero falló su notificación.`,
        );
      }
    }
    return {
      statusCode: HttpStatus.CREATED,
      message: result.replayed
        ? 'Orden ya guardada; se recuperó sin duplicarla.'
        : 'Orden de compra creada exitosamente.',
      data: result.order,
    };
  }

  private async allocateCode(
    tx: Prisma.TransactionClient,
    baseCode: string,
    supplierId: number,
  ) {
    const supplier = await tx.supplier.findUnique({
      where: { supplierId },
      select: { abbreviation: true },
    });
    if (
      !supplier?.abbreviation ||
      !/^[A-Z0-9]{1,10}$/.test(supplier.abbreviation)
    ) {
      throw new BadRequestException(
        'El proveedor debe tener una abreviatura válida para generar el código.',
      );
    }
    const year = new Date().getFullYear();
    const orders = await tx.purchaseOrder.findMany({
      where: { code: { contains: `-${year}/` } },
      select: { code: true },
    });
    let maximum = 0;
    for (const order of orders) {
      const match = /^No\s+(\d+)-(\d{4})\/.+\/[^/]+$/.exec(order.code);
      if (match && Number(match[2]) === year)
        maximum = Math.max(maximum, Number(match[1]));
    }
    return `No ${String(maximum + 1).padStart(3, '0')}-${year}/${baseCode}/${supplier.abbreviation}`;
  }
  async formatedCode(
    purchaseOrderId: number,
    code: string,
    supplierId?: number,
  ) {
    const year = new Date().getFullYear();
    const yearMarker = `-${year}/`;
    const sequencePattern = /^No\s+(\d+)-\d{4}\/.+\/[^/]+$/;

    // Si la OC ya tenía un correlativo válido, lo conservamos (por ejemplo, en updates).
    const currentPurchaseOrder = await this.prisma.purchaseOrder.findUnique({
      where: { purchaseOrderId },
      select: { code: true, supplier: { select: { abbreviation: true } } },
    });

    // An issued code is a historical identifier, not a live supplier label.
    if (currentPurchaseOrder?.code?.match(sequencePattern)) {
      return currentPurchaseOrder.code;
    }

    const supplier = supplierId
      ? await this.prisma.supplier.findUnique({
          where: { supplierId },
          select: { abbreviation: true },
        })
      : currentPurchaseOrder?.supplier;

    if (
      !supplier?.abbreviation ||
      !/^[A-Z0-9]{1,10}$/.test(supplier.abbreviation)
    ) {
      throw new BadRequestException(
        'El proveedor debe tener una abreviatura válida para generar el código.',
      );
    }

    const purchaseOrders = await this.prisma.purchaseOrder.findMany({
      where: { code: { contains: yearMarker } },
      select: { code: true },
    });

    let maxSequence = 0;
    for (const po of purchaseOrders) {
      const match = po.code?.match(sequencePattern);
      const seq = match ? Number(match[1]) : NaN;
      if (Number.isInteger(seq) && seq > 0) {
        maxSequence = Math.max(maxSequence, seq);
      }
    }

    const sequenceToUse = maxSequence + 1;
    const formattedSequence = sequenceToUse.toString().padStart(3, '0');
    const supplierAbbreviation = supplier.abbreviation;
    const formattedCode = `No ${formattedSequence}-${year}/${code}/${supplierAbbreviation}`;
    return formattedCode;
  }

  async findDirectory() {
    const orders = await this.prisma.purchaseOrder.findMany({
      where: { project: { deletedAt: null } },
      select: {
        purchaseOrderId: true,
        code: true,
        projectId: true,
        project: { select: { name: true } },
        supplier: { select: { name: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { purchaseOrderId: 'desc' }],
    });
    return { statusCode: HttpStatus.OK, data: orders };
  }

  async findDashboard(query: PurchaseOrderDashboardQueryDto) {
    const today = new Date();
    const month = query.month ?? today.getMonth() + 1;
    const year = query.year ?? today.getFullYear();
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 1));

    const where = {
      createdAt: { gte: from, lt: to },
      ...(query.status ? { status: query.status } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.purchaseOrderType
        ? { purchaseOrderType: query.purchaseOrderType }
        : {}),
      ...(query.currency ? { supplier: { currency: query.currency } } : {}),
    };

    const [purchaseOrders, projects] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        select: {
          purchaseOrderId: true,
          code: true,
          purchaseOrderType: true,
          purchaseAmount: true,
          saleAmount: true,
          status: true,
          createdAt: true,
          projectId: true,
          supplierId: true,
          project: {
            select: { projectId: true, name: true },
          },
          supplier: {
            select: { supplierId: true, name: true, currency: true },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { purchaseOrderId: 'desc' }],
      }),
      this.prisma.project.findMany({
        where: { deletedAt: null },
        select: { projectId: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const orders = purchaseOrders.map((purchaseOrder) => ({
      purchaseOrderId: purchaseOrder.purchaseOrderId,
      code: purchaseOrder.code,
      purchaseOrderType: purchaseOrder.purchaseOrderType,
      purchaseAmount: Number(purchaseOrder.purchaseAmount),
      saleAmount: Number(purchaseOrder.saleAmount),
      margin:
        Number(purchaseOrder.saleAmount) - Number(purchaseOrder.purchaseAmount),
      status: purchaseOrder.status,
      createdAt: purchaseOrder.createdAt,
      projectId: purchaseOrder.projectId,
      projectName: purchaseOrder.project.name,
      supplierId: purchaseOrder.supplierId,
      supplierName: purchaseOrder.supplier.name,
      currency: purchaseOrder.supplier.currency,
    }));

    const nonCancelledOrders = orders.filter(
      (purchaseOrder) => purchaseOrder.status !== PurchaseOrderStatus.Cancelled,
    );
    const purchaseAmount = nonCancelledOrders.reduce(
      (total, purchaseOrder) => total + purchaseOrder.purchaseAmount,
      0,
    );
    const saleAmount = nonCancelledOrders.reduce(
      (total, purchaseOrder) => total + purchaseOrder.saleAmount,
      0,
    );
    const margin = saleAmount - purchaseAmount;

    const statusDistribution = Object.values(PurchaseOrderStatus).map(
      (status) => {
        const statusOrders = orders.filter(
          (purchaseOrder) => purchaseOrder.status === status,
        );
        return {
          status,
          label: PurchaseOrderStatusLabelEs[status],
          count: statusOrders.length,
          purchaseAmount: statusOrders.reduce(
            (total, purchaseOrder) => total + purchaseOrder.purchaseAmount,
            0,
          ),
        };
      },
    );

    const weeksInMonth = Math.ceil(
      new Date(Date.UTC(year, month, 0)).getUTCDate() / 7,
    );
    const weeklyTrend = Array.from({ length: weeksInMonth }, (_, index) => {
      const week = index + 1;
      const startDay = index * 7 + 1;
      const endDay = Math.min(
        startDay + 6,
        new Date(Date.UTC(year, month, 0)).getUTCDate(),
      );
      const weekOrders = orders.filter(
        (purchaseOrder) =>
          Math.floor((purchaseOrder.createdAt.getUTCDate() - 1) / 7) + 1 ===
          week,
      );
      const activeWeekOrders = weekOrders.filter(
        (purchaseOrder) =>
          purchaseOrder.status !== PurchaseOrderStatus.Cancelled,
      );

      return {
        week,
        label: `${startDay}-${endDay}`,
        count: weekOrders.length,
        purchaseAmount: activeWeekOrders.reduce(
          (total, purchaseOrder) => total + purchaseOrder.purchaseAmount,
          0,
        ),
        saleAmount: activeWeekOrders.reduce(
          (total, purchaseOrder) => total + purchaseOrder.saleAmount,
          0,
        ),
      };
    });

    const buildRanking = (
      key: 'projectId' | 'supplierId',
      nameKey: 'projectName' | 'supplierName',
    ) => {
      const ranking = new Map<
        number,
        { id: number; name: string; count: number; purchaseAmount: number }
      >();

      for (const purchaseOrder of nonCancelledOrders) {
        const id = purchaseOrder[key];
        const current = ranking.get(id) ?? {
          id,
          name: purchaseOrder[nameKey],
          count: 0,
          purchaseAmount: 0,
        };
        current.count += 1;
        current.purchaseAmount += purchaseOrder.purchaseAmount;
        ranking.set(id, current);
      }

      return [...ranking.values()]
        .sort(
          (first, second) =>
            second.purchaseAmount - first.purchaseAmount ||
            second.count - first.count,
        )
        .slice(0, 5);
    };

    const now = Date.now();
    const oldestPendingOrders = orders
      .filter(
        (purchaseOrder) => purchaseOrder.status === PurchaseOrderStatus.Pending,
      )
      .sort(
        (first, second) =>
          first.createdAt.getTime() - second.createdAt.getTime(),
      )
      .slice(0, 5)
      .map((purchaseOrder) => ({
        ...purchaseOrder,
        daysPending: Math.max(
          0,
          Math.floor((now - purchaseOrder.createdAt.getTime()) / 86_400_000),
        ),
      }));

    const countByStatus = (status: PurchaseOrderStatus) =>
      orders.filter((purchaseOrder) => purchaseOrder.status === status).length;

    return {
      statusCode: HttpStatus.OK,
      message: 'Dashboard de órdenes de compra obtenido exitosamente.',
      data: {
        period: { month, year },
        appliedFilters: {
          currency: query.currency ?? null,
          status: query.status ?? null,
          projectId: query.projectId ?? null,
          purchaseOrderType: query.purchaseOrderType ?? null,
        },
        filterOptions: { projects },
        totals: {
          totalOrders: orders.length,
          pendingOrders: countByStatus(PurchaseOrderStatus.Pending),
          authorizedOrders: countByStatus(PurchaseOrderStatus.Authorized),
          deliveredOrders: countByStatus(PurchaseOrderStatus.Delivered),
          cancelledOrders: countByStatus(PurchaseOrderStatus.Cancelled),
          purchaseAmount,
          saleAmount,
          margin,
          marginPercent:
            purchaseAmount === 0 ? 0 : (margin / purchaseAmount) * 100,
        },
        statusDistribution,
        weeklyTrend,
        topProjects: buildRanking('projectId', 'projectName'),
        topSuppliers: buildRanking('supplierId', 'supplierName'),
        oldestPendingOrders,
        latestOrders: orders.slice(0, 10),
      },
    };
  }

  async findAllByProjectId(projectId: number) {
    this.logger.log(
      `Fetching all purchase orders for project id: ${projectId}`,
    );
    const purchaseOrders = await this.prisma.purchaseOrder.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        project: true,
        supplier: true,
      },
    });

    if (!purchaseOrders || purchaseOrders.length === 0) {
      this.logger.error('Failed to fetch purchase orders');
      throw new NotFoundException(
        'No se encontraron órdenes de compra para este proyecto.',
      );
    }

    const processedPurchaseOrder = purchaseOrders.map((po) => {
      const status =
        PurchaseOrderStatusLabelEs[
          po.status as keyof typeof PurchaseOrderStatusLabelEs
        ] || 'Desconocido';
      return { ...po, status, statusCode: po.status };
    });

    this.logger.log(`Fetched ${purchaseOrders.length} purchase orders`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Órdenes de compra obtenidas exitosamente.',
      data: processedPurchaseOrder,
    };
  }

  async findProjectSummary(
    projectId: number,
    query: PurchaseOrderSummaryQueryDto,
  ) {
    const project = await this.findProject(projectId);
    const search = query.search?.trim();
    const supplierFilter = {
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.currency ? { currency: query.currency } : {}),
    };

    const purchaseOrders = await this.prisma.purchaseOrder.findMany({
      where: {
        projectId,
        ...(search
          ? { code: { contains: search, mode: 'insensitive' as const } }
          : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.purchaseOrderType
          ? { purchaseOrderType: query.purchaseOrderType }
          : {}),
        ...(Object.keys(supplierFilter).length > 0
          ? { supplier: supplierFilter }
          : {}),
      },
      select: {
        purchaseOrderId: true,
        code: true,
        purchaseOrderType: true,
        purchaseAmount: true,
        saleAmount: true,
        status: true,
        supplierId: true,
        supplier: {
          select: { supplierId: true, name: true, currency: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { purchaseOrderId: 'desc' }],
    });

    const orders = purchaseOrders.map((purchaseOrder) => {
      const purchaseAmount = Number(purchaseOrder.purchaseAmount);
      const saleAmount = Number(purchaseOrder.saleAmount);
      const purchaseOrderType =
        purchaseOrder.purchaseOrderType as PurchaseOrderType;
      const currency = purchaseOrder.supplier.currency as Currency;
      const status = purchaseOrder.status as PurchaseOrderStatus;
      return {
        purchaseOrderId: purchaseOrder.purchaseOrderId,
        code: purchaseOrder.code,
        supplierId: purchaseOrder.supplierId,
        supplierName: purchaseOrder.supplier.name,
        purchaseOrderType,
        purchaseOrderTypeLabel: PurchaseOrderTypeLabelEs[purchaseOrderType],
        currency,
        purchaseAmount,
        saleAmount,
        margin: saleAmount - purchaseAmount,
        status,
        statusLabel: PurchaseOrderStatusLabelEs[status],
      };
    });

    const emptyAmount = (): PurchaseOrderSummaryAmount => ({
      purchaseAmount: 0,
      saleAmount: 0,
      margin: 0,
    });
    const byCurrency: PurchaseOrderProjectSummary['totals']['byCurrency'] = {
      [Currency.PEN]: emptyAmount(),
      [Currency.USD]: emptyAmount(),
      [Currency.EUR]: emptyAmount(),
    };
    const activeOrders = orders.filter(
      (purchaseOrder) => purchaseOrder.status !== PurchaseOrderStatus.Cancelled,
    );

    for (const purchaseOrder of activeOrders) {
      const totals = byCurrency[purchaseOrder.currency];
      totals.purchaseAmount += purchaseOrder.purchaseAmount;
      totals.saleAmount += purchaseOrder.saleAmount;
      totals.margin += purchaseOrder.margin;
    }

    const supplierName = query.supplierId
      ? (orders.find((order) => order.supplierId === query.supplierId)
          ?.supplierName ??
        (
          await this.prisma.supplier.findUnique({
            where: { supplierId: query.supplierId },
            select: { name: true },
          })
        )?.name ??
        null)
      : null;

    const summary: PurchaseOrderProjectSummary = {
      project: {
        projectId: project.projectId,
        code: project.code,
        name: project.name,
      },
      filters: {
        search: search || null,
        supplierId: query.supplierId ?? null,
        supplierName,
        currency: query.currency ?? null,
        status: query.status ?? null,
        purchaseOrderType: query.purchaseOrderType ?? null,
      },
      totals: {
        totalOrders: orders.length,
        activeOrders: activeOrders.length,
        cancelledOrders: orders.length - activeOrders.length,
        byCurrency,
      },
      orders,
    };

    return {
      statusCode: HttpStatus.OK,
      message: 'Resumen de órdenes de compra obtenido exitosamente.',
      data: summary,
    };
  }

  async findPaginatedByProject(
    projectId: number,
    query: ListPurchaseOrdersQueryDto,
  ) {
    const search = query.search?.trim();
    const where = {
      projectId,
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' as const } },
              {
                destination: { contains: search, mode: 'insensitive' as const },
              },
              {
                carePerson: { contains: search, mode: 'insensitive' as const },
              },
              {
                supplier: {
                  name: { contains: search, mode: 'insensitive' as const },
                },
              },
            ],
          }
        : {}),
    };
    const { skip, take } = getPaginationArgs(query);
    const [purchaseOrders, totalItems] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        include: { project: true, supplier: true },
        orderBy: [{ createdAt: 'desc' }, { purchaseOrderId: 'desc' }],
        skip,
        take,
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);
    const items = purchaseOrders.map((purchaseOrder) => ({
      ...purchaseOrder,
      status:
        PurchaseOrderStatusLabelEs[
          purchaseOrder.status as keyof typeof PurchaseOrderStatusLabelEs
        ] || 'Desconocido',
    }));

    return {
      statusCode: HttpStatus.OK,
      message: 'Órdenes de compra obtenidas exitosamente.',
      data: buildPaginatedData(items, totalItems, query),
    };
  }

  async findUnitValuesByProject(projectId: number) {
    this.logger.log(
      `Fetching purchase order unit values for project id: ${projectId}`,
    );

    await this.findProject(projectId);

    const purchaseOrders = await this.prisma.purchaseOrder.findMany({
      where: { projectId },
      orderBy: [{ createdAt: 'desc' }, { purchaseOrderId: 'desc' }],
      include: {
        supplier: true,
        resources: {
          orderBy: [{ orderNumber: 'asc' }, { resourcePurchaseOrderId: 'asc' }],
          include: {
            resource: true,
          },
        },
      },
    });

    const data = purchaseOrders.flatMap((purchaseOrder) =>
      purchaseOrder.resources.map((item) => ({
        resourcePurchaseOrderId: item.resourcePurchaseOrderId,
        purchaseOrderId: purchaseOrder.purchaseOrderId,
        purchaseOrderCode: purchaseOrder.code,
        purchaseOrderType: purchaseOrder.purchaseOrderType,
        description: item.resource?.description ?? 'Sin descripcion',
        supplierId: purchaseOrder.supplierId,
        supplierName: purchaseOrder.supplier?.name ?? 'N/A',
        currency: purchaseOrder.supplier?.currency ?? null,
        unitPurchasePrice: Number(item.unitPurchasePrice),
        orderNumber: item.orderNumber,
      })),
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Valores unitarios obtenidos exitosamente.',
      data,
    };
  }

  async findOne(id: number) {
    this.logger.log(`Fetching purchase order with id: ${id}`);
    const purchaseOrder = await this.prisma.purchaseOrder.findUnique({
      where: { purchaseOrderId: id },
      include: {
        project: true,
        supplier: true,
        resources: {
          orderBy: [{ orderNumber: 'asc' }, { createdAt: 'desc' }],
          include: {
            resource: true,
          },
        },
      },
    });

    if (!purchaseOrder) {
      this.logger.error(`Purchase order with id: ${id} not found`);
      throw new BadRequestException(`Purchase order with id: ${id} not found`);
    }

    const arrayCode = purchaseOrder.code.split('/');

    const processedPurchaseOrder = {
      ...purchaseOrder,
      code: arrayCode[1],
      codeComplete: purchaseOrder.code,
      status:
        PurchaseOrderStatusLabelEs[
          purchaseOrder.status as keyof typeof PurchaseOrderStatusLabelEs
        ] || 'Desconocido',
    };

    this.logger.log(`Purchase order with id: ${id} found`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Orden de compra obtenida exitosamente.',
      data: processedPurchaseOrder,
    };
  }

  private async sumAmountsByProject(
    projectId: number,
    amountField: 'purchaseAmount' | 'saleAmount',
  ) {
    this.logger.log(
      `Calculating total amount of all purchase orders for project id: ${projectId}`,
    );

    const purchaseOrders = await this.prisma.purchaseOrder.findMany({
      where: {
        projectId,
        status: { not: PurchaseOrderStatus.Cancelled },
      },
      select: {
        purchaseOrderType: true,
        purchaseAmount: true,
        saleAmount: true,
        supplier: { select: { currency: true } },
      },
    });

    const emptyTotals = () => ({
      [Currency.PEN]: 0,
      [Currency.USD]: 0,
      [Currency.EUR]: 0,
    });
    const totals = emptyTotals();
    const byType = {
      [PurchaseOrderType.Materials]: emptyTotals(),
      [PurchaseOrderType.Services]: emptyTotals(),
    };

    for (const purchaseOrder of purchaseOrders) {
      const currency = purchaseOrder.supplier.currency;
      const amount = Number(purchaseOrder[amountField] ?? 0);
      totals[currency] += amount;
      byType[purchaseOrder.purchaseOrderType][currency] += amount;
    }

    const serializeTotals = (amounts: Record<Currency, number>) => ({
      totalPEN: amounts[Currency.PEN],
      totalUSD: amounts[Currency.USD],
      totalEUR: amounts[Currency.EUR],
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Total amounts calculated successfully.',
      data: {
        ...serializeTotals(totals),
        byType: {
          [PurchaseOrderType.Materials]: serializeTotals(
            byType[PurchaseOrderType.Materials],
          ),
          [PurchaseOrderType.Services]: serializeTotals(
            byType[PurchaseOrderType.Services],
          ),
        },
      },
    };
  }

  async sumAllPurchaseAmountsByProject(projectId: number) {
    return this.sumAmountsByProject(projectId, 'purchaseAmount');
  }

  async sumAllSalesAmountsByProject(projectId: number) {
    return this.sumAmountsByProject(projectId, 'saleAmount');
  }

  async update(
    purchaseOrderId: number,
    updatePurchaseOrderDto: UpdatePurchaseOrderDto,
  ) {
    this.logger.log(`Updating purchase order with id: ${purchaseOrderId}`);

    let previousStatus: string | null = null;
    const updatedPurchaseOrder = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(20260921, 1)`;
        // Obtener el estado anterior si hay cambio de estado
        if (updatePurchaseOrderDto.status) {
          const currentPO = await tx.purchaseOrder.findUnique({
            where: { purchaseOrderId },
            select: { status: true },
          });
          previousStatus = currentPO?.status || null;
        }

        // Only the editable reference can change; keep the issued number/year/suffix.
        const { code, ...otherData } = updatePurchaseOrderDto;
        const updateData: UpdatePurchaseOrderDto = { ...otherData };
        if (code !== undefined) {
          const reference = code.trim();
          if (!reference || reference.includes('/')) {
            throw new BadRequestException(
              'El código de referencia es obligatorio y no puede contener /.',
            );
          }
          const current = await tx.purchaseOrder.findUnique({
            where: { purchaseOrderId },
            select: { code: true },
          });
          const parts = current?.code.match(
            /^(No\s+\d+-\d{4}\/)([^/]+)(\/[^/]+)$/i,
          );
          if (!parts) {
            throw new BadRequestException(
              'El código existente no tiene el formato esperado. No se modificó la orden.',
            );
          }
          updateData.code = `${parts[1]}${reference}${parts[3]}`;
        }

        return tx.purchaseOrder.update({
          where: { purchaseOrderId },
          data: updateData,
          include: {
            project: true,
          },
        });
      },
      { maxWait: 15000, timeout: 30000 },
    );

    if (!updatedPurchaseOrder) {
      this.logger.error(
        `Failed to update purchase order with id: ${purchaseOrderId}`,
      );
      throw new BadRequestException(
        'No se pudo actualizar la orden de compra.',
      );
    }

    // Notificar si hubo cambio de estado
    if (
      updatePurchaseOrderDto.status &&
      previousStatus !== updatePurchaseOrderDto.status
    ) {
      const code = updatedPurchaseOrder.code;

      switch (updatePurchaseOrderDto.status) {
        case PurchaseOrderStatus.Authorized:
          await this.notificationService.notifyPurchaseOrderAuthorized(
            purchaseOrderId,
            code,
            updatedPurchaseOrder.projectId,
          );
          break;
        case PurchaseOrderStatus.Delivered:
          await this.notificationService.notifyPurchaseOrderDelivered(
            purchaseOrderId,
            code,
            updatedPurchaseOrder.projectId,
          );
          break;
        case PurchaseOrderStatus.Cancelled:
          await this.notificationService.notifyPurchaseOrderCancelled(
            purchaseOrderId,
            code,
            updatedPurchaseOrder.projectId,
          );
          break;
      }
    }

    this.logger.log(
      `Purchase order with id: ${purchaseOrderId} updated successfully`,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Orden de compra actualizada exitosamente.',
      data: updatedPurchaseOrder,
    };
  }

  async duplicate(
    purchaseOrderId: number,
    projectId: number,
    creationKey: string,
    userId: number,
  ) {
    const requestHash = createHash('sha256')
      .update(canonical({ duplicate: purchaseOrderId, projectId }))
      .digest('hex');
    const saved = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(20260921, 1)`;
        const receipt = await tx.purchaseOrderCreation.findUnique({
          where: { userId_key: { userId, key: creationKey } },
        });
        if (receipt) {
          if (receipt.requestHash !== requestHash)
            throw new ConflictException(
              'Este intento ya fue usado para otra orden.',
            );
          const order = await tx.purchaseOrder.findUnique({
            where: { purchaseOrderId: receipt.purchaseOrderId },
          });
          if (!order)
            throw new ConflictException(
              'La copia de este intento fue eliminada; no se volverá a crear al reintentar.',
            );
          return order;
        }
        const original = await tx.purchaseOrder.findUnique({
          where: { purchaseOrderId },
          include: { resources: true },
        });
        if (!original)
          throw new NotFoundException('No se encontró la orden original.');
        if (
          !(await tx.project.findFirst({
            where: { projectId, deletedAt: null },
          }))
        )
          throw new BadRequestException('Proyecto no encontrado.');
        const {
          purchaseOrderId: oldId,
          resources,
          createdAt,
          updatedAt,
          ...data
        } = original;
        void oldId;
        void createdAt;
        void updatedAt;
        const code = await this.allocateCode(
          tx,
          `COPY-${original.code.split('/')[1] || original.code}`,
          original.supplierId,
        );
        const order = await tx.purchaseOrder.create({
          data: { ...data, code, projectId, status: 'pending' },
        });
        if (resources.length)
          await tx.resourcePurchaseOrder.createMany({
            data: resources.map(
              ({
                resourcePurchaseOrderId,
                purchaseOrderId: oldOrderId,
                ...item
              }) => {
                void resourcePurchaseOrderId;
                void oldOrderId;
                return { ...item, purchaseOrderId: order.purchaseOrderId };
              },
            ),
          });
        await tx.purchaseOrderCreation.create({
          data: {
            userId,
            key: creationKey,
            requestHash,
            purchaseOrderId: order.purchaseOrderId,
          },
        });
        return order;
      },
      { maxWait: 15000, timeout: 30000 },
    );
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Copia guardada exitosamente.',
      data: saved,
    };
  }
  async remove(purchaseOrderId: number) {
    this.logger.log(`Removing purchase order with id: ${purchaseOrderId}`);
    const [, deletedPurchaseOrder] = await this.prisma.$transaction([
      this.prisma.notification.deleteMany({
        where: { purchaseOrderId },
      }),
      this.prisma.purchaseOrder.delete({
        where: { purchaseOrderId },
      }),
    ]);

    if (!deletedPurchaseOrder) {
      this.logger.error(
        `Failed to remove purchase order with id: ${purchaseOrderId}`,
      );
      throw new BadRequestException('No se pudo eliminar la orden de compra.');
    }

    this.logger.log(
      `Purchase order with id: ${purchaseOrderId} removed successfully`,
    );
    return deletedPurchaseOrder;
  }

  async findProject(projectId: number) {
    this.logger.log(`Fetching project with id: ${projectId}`);
    const project = await this.prisma.project.findUnique({
      where: { projectId },
    });

    if (!project) {
      this.logger.error(`Project with id: ${projectId} not found`);
      throw new BadRequestException(`Project with id: ${projectId} not found`);
    }

    this.logger.log(`Project with id: ${projectId} found`);
    return project;
  }
}
