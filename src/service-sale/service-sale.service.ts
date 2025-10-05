import { Injectable } from '@nestjs/common';
import { CreateServiceSaleDto } from './dto/create-service-sale.dto';
import { UpdateServiceSaleDto } from './dto/update-service-sale.dto';

@Injectable()
export class ServiceSaleService {
  create(createServiceSaleDto: CreateServiceSaleDto) {
    return 'This action adds a new serviceSale';
  }

  findAll() {
    return `This action returns all serviceSale`;
  }

  findOne(id: number) {
    return `This action returns a #${id} serviceSale`;
  }

  update(id: number, updateServiceSaleDto: UpdateServiceSaleDto) {
    return `This action updates a #${id} serviceSale`;
  }

  remove(id: number) {
    return `This action removes a #${id} serviceSale`;
  }
}
