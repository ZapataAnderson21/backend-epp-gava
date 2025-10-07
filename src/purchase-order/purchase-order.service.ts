import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { PrismaService } from 'src/prisma/prisma.service';

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
    return newPurchaseOrder;
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

    if (!purchaseOrders) {
      this.logger.error('Failed to fetch purchase orders');
    }

    this.logger.log(`Fetched ${purchaseOrders.length} purchase orders`);
    return purchaseOrders;
  }


  async findOne(id: number) {
    this.logger.log(`Fetching purchase order with id: ${id}`);
    const purchaseOrder = await this.prisma.purchaseOrder.findUnique({
      where: { purchaseOrderId: id },
      include: {
        project: true,
        supplier: true,
      },
    });

    if (!purchaseOrder) {
      this.logger.error(`Purchase order with id: ${id} not found`);
      throw new BadRequestException(`Purchase order with id: ${id} not found`);
    }

    this.logger.log(`Purchase order with id: ${id} found`);
    return purchaseOrder;
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
