import { PartialType } from '@nestjs/swagger';
import { CreateServiceSaleDto } from './create-service-sale.dto';

export class UpdateServiceSaleDto extends PartialType(CreateServiceSaleDto) {}
