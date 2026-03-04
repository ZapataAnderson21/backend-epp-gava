import { BadRequestException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Currency } from 'src/supplier/enum/currency.enum';
import { PurchaseOrderStatusLabelEs, PurchaseOrderStatus } from './enum';
import { NotificationService } from 'src/notification/notification.service';

@Injectable()
export class PurchaseOrderService {

  private readonly logger = new Logger("PurchaseOrderService");

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

    const code = await this.formatedCode(newPurchaseOrder.purchaseOrderId, newPurchaseOrder.code);
  
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
      this.logger.error(`Failed to update purchase order with id: ${newPurchaseOrder.purchaseOrderId}`);
      throw new BadRequestException('No se pudo actualizar la orden de compra con el código generado.');
    }

    // Notificar a GERENTE sobre nueva orden de compra pendiente
    await this.notificationService.notifyPurchaseOrderPending(
      newPurchaseOrder.purchaseOrderId,
      code,
      newPurchaseOrder.project?.name || 'Proyecto',
      newPurchaseOrder.projectId,
    );

    this.logger.log(`Purchase order created successfully with id: ${updatedPurchaseOrder.purchaseOrderId}`);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Orden de compra creada exitosamente.',
      data: updatedPurchaseOrder,
    };
  }

  async formatedCode(purchaseOrderId: number, code: string) {

    const formattedId = purchaseOrderId.toString().padStart(3, '0');
    const year = new Date().getFullYear();
    const formattedCode = `No ${formattedId}-${year}/${code}/GAVA`;
    return formattedCode;
  }

  
  async findAllByProjectId(projectId: number) {
    this.logger.log(`Fetching all purchase orders for project id: ${projectId}`);
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
      throw new NotFoundException('No se encontraron órdenes de compra para este proyecto.');
    }

    const processedPurchaseOrder = purchaseOrders.map(po => {
      const status = PurchaseOrderStatusLabelEs[po.status as keyof typeof PurchaseOrderStatusLabelEs] || 'Desconocido';
      return { ...po, status };
    });

    this.logger.log(`Fetched ${purchaseOrders.length} purchase orders`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Órdenes de compra obtenidas exitosamente.',
      data: processedPurchaseOrder
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
          orderBy: [
            { orderNumber: 'asc' },
            { createdAt: 'desc' },
          ],
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
      status: PurchaseOrderStatusLabelEs[purchaseOrder.status as keyof typeof PurchaseOrderStatusLabelEs] || 'Desconocido'
    };

    this.logger.log(`Purchase order with id: ${id} found`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Orden de compra obtenida exitosamente.',
      data: processedPurchaseOrder
    };
  }

  async sumAllPurchaseAmountsByProject(projectId: number) {
    this.logger.log(`Calculating total amount of all purchase orders for project id: ${projectId}`);
    const totalPEN = await this.prisma.purchaseOrder.aggregate({
      where: {
        supplier: { currency: Currency.PEN },
        projectId
      },
      _sum: { purchaseAmount: true },
    });

    const totalUSD = await this.prisma.purchaseOrder.aggregate({
      where: {
        supplier: { currency: Currency.USD },
        projectId
      },
      _sum: { purchaseAmount: true },
    });

    const totalEUR = await this.prisma.purchaseOrder.aggregate({
      where: {
        supplier: { currency: Currency.EUR },
        projectId
      },
      _sum: { purchaseAmount: true },
    });

    const data = {
      totalPEN: Number(totalPEN._sum.purchaseAmount),
      totalUSD: Number(totalUSD._sum.purchaseAmount),
      totalEUR: Number(totalEUR._sum.purchaseAmount)
    };

    return {
      statusCode: HttpStatus.OK,
      message: 'Total amounts calculated successfully.',
      data
    };
  }

  async sumAllSalesAmountsByProject(projectId: number) {
    this.logger.log(`Calculating total amount of all purchase orders for project id: ${projectId}`);
    const totalPEN = await this.prisma.purchaseOrder.aggregate({
      where: {
        supplier: { currency: Currency.PEN },
        projectId
      },
      _sum: { saleAmount: true },
    });

    const totalUSD = await this.prisma.purchaseOrder.aggregate({
      where: {
        supplier: { currency: Currency.USD },
        projectId
      },
      _sum: { saleAmount: true },
    });

    const totalEUR = await this.prisma.purchaseOrder.aggregate({
      where: {
        supplier: { currency: Currency.EUR },
        projectId
      },
      _sum: { saleAmount: true },
    });

    const data = {
      totalPEN : Number(totalPEN._sum.saleAmount),
      totalUSD : Number(totalUSD._sum.saleAmount),
      totalEUR : Number(totalEUR._sum.saleAmount)
    };

    return {
      statusCode: HttpStatus.OK,
      message: 'Total amounts calculated successfully.',
      data
    };
  }

  async update(purchaseOrderId: number, updatePurchaseOrderDto: UpdatePurchaseOrderDto) {
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

    if(updatePurchaseOrderDto.code){
      const code = await this.formatedCode(purchaseOrderId, updatePurchaseOrderDto.code);
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
      this.logger.error(`Failed to update purchase order with id: ${purchaseOrderId}`);
      throw new BadRequestException('No se pudo actualizar la orden de compra.');
    }

    // Notificar si hubo cambio de estado
    if (updatePurchaseOrderDto.status && previousStatus !== updatePurchaseOrderDto.status) {
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

    this.logger.log(`Purchase order with id: ${purchaseOrderId} updated successfully`);
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
      throw new NotFoundException(`No se encontró la orden de compra con id: ${purchaseOrderId}`);
    }

    // Verificar que el proyecto existe
    await this.findProject(projectId);

    // Extraer el código original (sin el formato)
    const arrayCode = originalPurchaseOrder.code.split('/');
    const originalCode = arrayCode[1] || originalPurchaseOrder.code;

    // Crear nueva orden de compra con los mismos datos pero nuevo projectId, código y estado pending
    const { purchaseOrderId: _, resources, createdAt, updatedAt, ...purchaseOrderData } = originalPurchaseOrder;

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
    const formattedCode = await this.formatedCode(newPurchaseOrder.purchaseOrderId, newPurchaseOrder.code);
    
    // Actualizar con el código formateado
    const updatedPurchaseOrder = await this.prisma.purchaseOrder.update({
      where: { purchaseOrderId: newPurchaseOrder.purchaseOrderId },
      data: { code: formattedCode },
    });

    // Duplicar los recursos asociados
    if (resources && resources.length > 0) {
      const resourcesData = resources.map(({ resourcePurchaseOrderId, purchaseOrderId: _, ...resource }) => ({
        ...resource,
        purchaseOrderId: newPurchaseOrder.purchaseOrderId,
      }));

      await this.prisma.resourcePurchaseOrder.createMany({
        data: resourcesData,
      });
    }

    this.logger.log(`Purchase order duplicated successfully with id: ${newPurchaseOrder.purchaseOrderId}`);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Orden de compra duplicada exitosamente.',
      data: updatedPurchaseOrder,
    };
  }

  async remove(purchaseOrderId: number) {
    this.logger.log(`Removing purchase order with id: ${purchaseOrderId}`);
    const deletedPurchaseOrder = await this.prisma.purchaseOrder.delete({
      where: { purchaseOrderId },
    });

    if (!deletedPurchaseOrder) {
      this.logger.error(`Failed to remove purchase order with id: ${purchaseOrderId}`);
      throw new BadRequestException('No se pudo eliminar la orden de compra.');
    }

    this.logger.log(`Purchase order with id: ${purchaseOrderId} removed successfully`);
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
