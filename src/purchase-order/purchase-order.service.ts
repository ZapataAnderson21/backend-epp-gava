import { BadRequestException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Currency } from 'src/supplier/enum/currency.enum';
import { PurchaseOrderStatus } from 'generated/prisma';
import { PurchaseOrderStatusLabelEs } from './enum';

@Injectable()
export class PurchaseOrderService {

  private readonly logger = new Logger("PurchaseOrderService");

  constructor(private readonly prisma: PrismaService) {}

  async create(createPurchaseOrderDto: CreatePurchaseOrderDto) {
    this.logger.log('Creating a new purchase order');
    const newPurchaseOrder = await this.prisma.purchaseOrder.create({
      data: createPurchaseOrderDto,
    });

    if (!newPurchaseOrder) {
      this.logger.error('Failed to create a new purchase order');
      throw new BadRequestException('No se pudo crear la orden de compra. ');
    }

    const year = new Date().getFullYear();

    const formattedId = newPurchaseOrder.purchaseOrderId.toString().padStart(3, '0');
    const code = `No ${formattedId}-${year}/${createPurchaseOrderDto.code}/GAVA`;
  
    this.logger.log(`Generated code for purchase order: ${code}`);
    const updatedPurchaseOrder = await this.update(newPurchaseOrder.purchaseOrderId, { code });

    if (!updatedPurchaseOrder) {
      this.logger.error(`Failed to update purchase order with id: ${newPurchaseOrder.purchaseOrderId}`);
      throw new BadRequestException('No se pudo actualizar la orden de compra con el código generado.');
    }

    this.logger.log(`Purchase order created successfully with id: ${newPurchaseOrder.purchaseOrderId}`);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Orden de compra creada exitosamente.',
      data: updatedPurchaseOrder,
    };
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

    const processedPurchaseOrder = {
      ...purchaseOrder,
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
      totalPEN: totalPEN._sum.purchaseAmount,
      totalUSD: totalUSD._sum.purchaseAmount,
      totalEUR: totalEUR._sum.purchaseAmount
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
      totalPEN : totalPEN._sum.saleAmount,
      totalUSD : totalUSD._sum.saleAmount,
      totalEUR : totalEUR._sum.saleAmount
    };

    return {
      statusCode: HttpStatus.OK,
      message: 'Total amounts calculated successfully.',
      data
    };
  }

  async update(purchaseOrderId: number, updatePurchaseOrderDto: UpdatePurchaseOrderDto) {
    this.logger.log(`Updating purchase order with id: ${purchaseOrderId}`);
    const updatedPurchaseOrder = await this.prisma.purchaseOrder.update({
      where: { purchaseOrderId },
      data: updatePurchaseOrderDto,
    });

    if (!updatedPurchaseOrder) {
      this.logger.error(`Failed to update purchase order with id: ${purchaseOrderId}`);
      throw new BadRequestException('No se pudo actualizar la orden de compra.');
    }

    this.logger.log(`Purchase order with id: ${purchaseOrderId} updated successfully`);
    return updatedPurchaseOrder;
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
