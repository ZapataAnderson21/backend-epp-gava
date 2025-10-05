import { Injectable } from '@nestjs/common';
import { CreateResourcePurchaseOrderDto } from './dto/create-resource-purchase-order.dto';
import { UpdateResourcePurchaseOrderDto } from './dto/update-resource-purchase-order.dto';

@Injectable()
export class ResourcePurchaseOrderService {
  create(createResourcePurchaseOrderDto: CreateResourcePurchaseOrderDto) {
    return 'This action adds a new resourcePurchaseOrder';
  }

  findAll() {
    return `This action returns all resourcePurchaseOrder`;
  }

  findOne(id: number) {
    return `This action returns a #${id} resourcePurchaseOrder`;
  }

  update(id: number, updateResourcePurchaseOrderDto: UpdateResourcePurchaseOrderDto) {
    return `This action updates a #${id} resourcePurchaseOrder`;
  }

  remove(id: number) {
    return `This action removes a #${id} resourcePurchaseOrder`;
  }
}
