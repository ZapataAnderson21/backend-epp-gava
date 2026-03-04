import { BadRequestException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CreateResourcePurchaseOrderDto } from './dto/create-resource-purchase-order.dto';
import { UpdateResourcePurchaseOrderDto } from './dto/update-resource-purchase-order.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ResourcePurchaseOrderService {

  private readonly logger = new Logger("ResourcePurchaseOrderService");

  constructor(private readonly prisma: PrismaService) {}

  async create(createResourcePurchaseOrderDto: CreateResourcePurchaseOrderDto) {
    this.logger.log('Creating a new resource purchase order');
    const newResourcePurchaseOrder = await this.prisma.resourcePurchaseOrder.create({
      data: createResourcePurchaseOrderDto,
    });

    if (!newResourcePurchaseOrder) {
      this.logger.error('Failed to create a new resource purchase order');
      throw new BadRequestException('No se pudo crear el recurso de la orden de compra.');
    }

    this.logger.log(`Resource purchase order created successfully with id: ${newResourcePurchaseOrder.purchaseOrderId}`);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Recurso de la orden de compra creado exitosamente.',
      data: newResourcePurchaseOrder,
    };
  }

  async findAllByPurchaseOrderId(purchaseOrderId: number) {
    this.logger.log(`Fetching all resource purchase orders for purchase order id: ${purchaseOrderId}`);

    this.logger.log(`Checking if purchase order exists with id: ${purchaseOrderId}`);
    const exists = await this.prisma.purchaseOrder.findUnique({
      where: { purchaseOrderId },
      select: { purchaseOrderId: true },
    });

    if (!exists) {
      this.logger.warn(`Purchase order does not exist with id: ${purchaseOrderId}`);
      throw new BadRequestException('La orden de compra no existe.');
    }

    const resourcePurchaseOrders = await this.prisma.resourcePurchaseOrder.findMany({
      where: { purchaseOrderId },
      orderBy: [
        { orderNumber: 'asc' },
        { createdAt: 'desc' },
      ],
      include: {
        resource: true,
      },
    });

    if (!resourcePurchaseOrders) {
      this.logger.error('Failed to fetch resource purchase orders');
      throw new BadRequestException('No se pudieron obtener los recursos de la orden de compra.');
    }

    this.logger.log(`Fetched ${resourcePurchaseOrders.length} resource purchase orders`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Recursos de la orden de compra obtenidos exitosamente.',
      data: resourcePurchaseOrders,
    };
  }

  async findOne(resourcePurchaseOrderId: number) {
    this.logger.log(`Fetching resource purchase order with id: ${resourcePurchaseOrderId}`);
    const resourcePurchaseOrder = await this.prisma.resourcePurchaseOrder.findUnique({
      where: { resourcePurchaseOrderId },
      include: {
        resource: true,
      },
    });

    if (!resourcePurchaseOrder) {
      this.logger.warn(`Resource purchase order does not exist with id: ${resourcePurchaseOrderId}`);
      throw new BadRequestException('La orden de compra no existe.');
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Recurso de la orden de compra obtenido exitosamente.',
      data: resourcePurchaseOrder,
    };
  }

  async update(id: number, updateResourcePurchaseOrderDto: UpdateResourcePurchaseOrderDto) {
    this.logger.log(`Updating resource purchase order with id: ${id}`);
    const updatedResourcePurchaseOrder = await this.prisma.resourcePurchaseOrder.update({
      where: { resourcePurchaseOrderId: id },
      data: updateResourcePurchaseOrderDto,
    });

    if (!updatedResourcePurchaseOrder) {
      this.logger.error(`Failed to update resource purchase order with id: ${id}`);
      throw new BadRequestException('No se pudo actualizar el recurso de la orden de compra.');
    }

    this.logger.log(`Resource purchase order with id: ${id} updated successfully`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Recurso de la orden de compra actualizado exitosamente.',
      data: updatedResourcePurchaseOrder,
    };
  }

  async remove(resourcePurchaseOrderId: number) {
    this.logger.log(`Deleting resource purchase order with id: ${resourcePurchaseOrderId}`);

    await this.findOne(resourcePurchaseOrderId);

    const deletedResourcePurchaseOrder = await this.prisma.resourcePurchaseOrder.delete({
      where: { resourcePurchaseOrderId },
    });

    if (!deletedResourcePurchaseOrder) {
      this.logger.error(`Failed to delete resource purchase order with id: ${resourcePurchaseOrderId}`);
      throw new BadRequestException('No se pudo eliminar el recurso de la orden de compra.');
    }

    this.logger.log(`Resource purchase order with id: ${resourcePurchaseOrderId} deleted successfully`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Recurso de la orden de compra eliminado exitosamente.',
      data: deletedResourcePurchaseOrder,
    };
  }

  async existsPurchaseOrder(purchaseOrderId: number) {
    this.logger.log(`Checking if purchase order exists with id: ${purchaseOrderId}`);
    const exists = await this.prisma.purchaseOrder.findUnique({
      where: { purchaseOrderId },
      select: { purchaseOrderId: true },
    });

    if (!exists) {
      this.logger.warn(`Purchase order does not exist with id: ${purchaseOrderId}`);
      return false;
    }

    return true;
  }
}
