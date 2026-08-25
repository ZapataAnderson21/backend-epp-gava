import {
  BadRequestException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Currency } from 'src/supplier/enum/currency.enum';
import { PurchaseOrderStatusLabelEs, PurchaseOrderStatus } from './enum';
import { NotificationService } from 'src/notification/notification.service';
import { buildPaginatedData, getPaginationArgs } from 'src/common/pagination';
import { ListPurchaseOrdersQueryDto } from './dto/list-purchase-orders-query.dto';

@Injectable()
export class PurchaseOrderService {
  private readonly logger = new Logger('PurchaseOrderService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(createPurchaseOrderDto: CreatePurchaseOrderDto) {
    this.logger.log('Creating a new purchase order');
    const newPurchaseOrder = await this.prisma.purchaseOrder.create({
      data: createPurchaseOrderDto,
      include: {
        project: true,
      },
    });

    if (!newPurchaseOrder) {
      this.logger.error('Failed to create a new purchase order');
      throw new BadRequestException('No se pudo crear la orden de compra. ');
    }

    const code = await this.formatedCode(
      newPurchaseOrder.purchaseOrderId,
      newPurchaseOrder.code,
    );

    this.logger.log(`Generated code for purchase order: ${code}`);

    // Actualizar directamente con Prisma para evitar doble formateo en this.update()
    const updatedPurchaseOrder = await this.prisma.purchaseOrder.update({
      where: { purchaseOrderId: newPurchaseOrder.purchaseOrderId },
      data: { code },
      include: {
        project: true,
      },
    });

    if (!updatedPurchaseOrder) {
      this.logger.error(
        `Failed to update purchase order with id: ${newPurchaseOrder.purchaseOrderId}`,
      );
      throw new BadRequestException(
        'No se pudo actualizar la orden de compra con el código generado.',
      );
    }

    // Notificar a GERENTE sobre nueva orden de compra pendiente
    await this.notificationService.notifyPurchaseOrderPending(
      newPurchaseOrder.purchaseOrderId,
      code,
      newPurchaseOrder.project?.name || 'Proyecto',
      newPurchaseOrder.projectId,
    );

    this.logger.log(
      `Purchase order created successfully with id: ${updatedPurchaseOrder.purchaseOrderId}`,
    );
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Orden de compra creada exitosamente.',
      data: updatedPurchaseOrder,
    };
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
      select: { code: true, supplier: { select: { name: true } } },
    });

    const supplier = supplierId
      ? await this.prisma.supplier.findUnique({
          where: { supplierId },
          select: { name: true },
        })
      : currentPurchaseOrder?.supplier;

    if (!supplier?.name) {
      throw new BadRequestException(
        'No se pudo obtener el proveedor para generar el código.',
      );
    }

    const currentMatch = currentPurchaseOrder?.code?.match(sequencePattern);
    const existingSequence = currentMatch ? Number(currentMatch[1]) : null;

    let sequenceToUse: number;

    if (
      existingSequence &&
      Number.isInteger(existingSequence) &&
      existingSequence > 0
    ) {
      sequenceToUse = existingSequence;
    } else {
      const purchaseOrders = await this.prisma.purchaseOrder.findMany({
        where: {
          code: { contains: yearMarker },
        },
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

      sequenceToUse = maxSequence + 1;
    }

    const formattedSequence = sequenceToUse.toString().padStart(3, '0');
    const supplierAbbreviation = this.abbreviateSupplierName(supplier.name);
    const formattedCode = `No ${formattedSequence}-${year}/${code}/${supplierAbbreviation}`;
    return formattedCode;
  }

  private abbreviateSupplierName(name: string): string {
    const ignoredWords = new Set([
      'DE',
      'DEL',
      'LA',
      'LAS',
      'LOS',
      'Y',
      'E',
      'SA',
      'SAC',
      'SRL',
      'EIRL',
      'SAA',
    ]);
    const words = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/\./g, '')
      .replace(/[^A-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word && !ignoredWords.has(word));

    if (words.length === 0) {
      return 'PROV';
    }

    if (words.length === 1) {
      return words[0].slice(0, 8);
    }

    return words
      .map((word) => word[0])
      .join('')
      .slice(0, 8);
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
      return { ...po, status };
    });

    this.logger.log(`Fetched ${purchaseOrders.length} purchase orders`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Órdenes de compra obtenidas exitosamente.',
      data: processedPurchaseOrder,
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
              { destination: { contains: search, mode: 'insensitive' as const } },
              { carePerson: { contains: search, mode: 'insensitive' as const } },
              { supplier: { name: { contains: search, mode: 'insensitive' as const } } },
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

  async sumAllPurchaseAmountsByProject(projectId: number) {
    this.logger.log(
      `Calculating total amount of all purchase orders for project id: ${projectId}`,
    );
    const totalPEN = await this.prisma.purchaseOrder.aggregate({
      where: {
        supplier: { currency: Currency.PEN },
        projectId,
      },
      _sum: { purchaseAmount: true },
    });

    const totalUSD = await this.prisma.purchaseOrder.aggregate({
      where: {
        supplier: { currency: Currency.USD },
        projectId,
      },
      _sum: { purchaseAmount: true },
    });

    const totalEUR = await this.prisma.purchaseOrder.aggregate({
      where: {
        supplier: { currency: Currency.EUR },
        projectId,
      },
      _sum: { purchaseAmount: true },
    });

    const data = {
      totalPEN: Number(totalPEN._sum.purchaseAmount),
      totalUSD: Number(totalUSD._sum.purchaseAmount),
      totalEUR: Number(totalEUR._sum.purchaseAmount),
    };

    return {
      statusCode: HttpStatus.OK,
      message: 'Total amounts calculated successfully.',
      data,
    };
  }

  async sumAllSalesAmountsByProject(projectId: number) {
    this.logger.log(
      `Calculating total amount of all purchase orders for project id: ${projectId}`,
    );
    const totalPEN = await this.prisma.purchaseOrder.aggregate({
      where: {
        supplier: { currency: Currency.PEN },
        projectId,
      },
      _sum: { saleAmount: true },
    });

    const totalUSD = await this.prisma.purchaseOrder.aggregate({
      where: {
        supplier: { currency: Currency.USD },
        projectId,
      },
      _sum: { saleAmount: true },
    });

    const totalEUR = await this.prisma.purchaseOrder.aggregate({
      where: {
        supplier: { currency: Currency.EUR },
        projectId,
      },
      _sum: { saleAmount: true },
    });

    const data = {
      totalPEN: Number(totalPEN._sum.saleAmount),
      totalUSD: Number(totalUSD._sum.saleAmount),
      totalEUR: Number(totalEUR._sum.saleAmount),
    };

    return {
      statusCode: HttpStatus.OK,
      message: 'Total amounts calculated successfully.',
      data,
    };
  }

  async update(
    purchaseOrderId: number,
    updatePurchaseOrderDto: UpdatePurchaseOrderDto,
  ) {
    this.logger.log(`Updating purchase order with id: ${purchaseOrderId}`);

    // Obtener el estado anterior si hay cambio de estado
    let previousStatus: string | null = null;
    if (updatePurchaseOrderDto.status) {
      const currentPO = await this.prisma.purchaseOrder.findUnique({
        where: { purchaseOrderId },
        select: { status: true },
      });
      previousStatus = currentPO?.status || null;
    }

    if (updatePurchaseOrderDto.code) {
      const code = await this.formatedCode(
        purchaseOrderId,
        updatePurchaseOrderDto.code,
        updatePurchaseOrderDto.supplierId,
      );
      updatePurchaseOrderDto.code = code;
      this.logger.log(`Formatted code for purchase order: ${code}`);
    }

    const updatedPurchaseOrder = await this.prisma.purchaseOrder.update({
      where: { purchaseOrderId },
      data: updatePurchaseOrderDto,
      include: {
        project: true,
      },
    });

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

  async duplicate(purchaseOrderId: number, projectId: number) {
    this.logger.log(`Duplicating purchase order with id: ${purchaseOrderId}`);

    // Obtener la orden de compra original con sus recursos
    const originalPurchaseOrder = await this.prisma.purchaseOrder.findUnique({
      where: { purchaseOrderId },
      include: {
        resources: true,
      },
    });

    if (!originalPurchaseOrder) {
      this.logger.error(`Purchase order with id: ${purchaseOrderId} not found`);
      throw new NotFoundException(
        `No se encontró la orden de compra con id: ${purchaseOrderId}`,
      );
    }

    // Verificar que el proyecto existe
    await this.findProject(projectId);

    // Extraer el código original (sin el formato)
    const arrayCode = originalPurchaseOrder.code.split('/');
    const originalCode = arrayCode[1] || originalPurchaseOrder.code;

    // Crear nueva orden de compra con los mismos datos pero nuevo projectId, código y estado pending
    const {
      purchaseOrderId: _,
      resources,
      createdAt,
      updatedAt,
      ...purchaseOrderData
    } = originalPurchaseOrder;

    const newPurchaseOrder = await this.prisma.purchaseOrder.create({
      data: {
        ...purchaseOrderData,
        projectId,
        code: `COPY-${originalCode}`,
        status: 'pending',
      },
    });

    if (!newPurchaseOrder) {
      this.logger.error('Failed to duplicate purchase order');
      throw new BadRequestException('No se pudo duplicar la orden de compra.');
    }

    // Generar el código formateado
    const formattedCode = await this.formatedCode(
      newPurchaseOrder.purchaseOrderId,
      newPurchaseOrder.code,
    );

    // Actualizar con el código formateado
    const updatedPurchaseOrder = await this.prisma.purchaseOrder.update({
      where: { purchaseOrderId: newPurchaseOrder.purchaseOrderId },
      data: { code: formattedCode },
    });

    // Duplicar los recursos asociados
    if (resources && resources.length > 0) {
      const resourcesData = resources.map(
        ({ resourcePurchaseOrderId, purchaseOrderId: _, ...resource }) => ({
          ...resource,
          purchaseOrderId: newPurchaseOrder.purchaseOrderId,
        }),
      );

      await this.prisma.resourcePurchaseOrder.createMany({
        data: resourcesData,
      });
    }

    this.logger.log(
      `Purchase order duplicated successfully with id: ${newPurchaseOrder.purchaseOrderId}`,
    );
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Orden de compra duplicada exitosamente.',
      data: updatedPurchaseOrder,
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
