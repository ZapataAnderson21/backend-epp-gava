import {
  BadRequestException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateServiceSaleDto } from './dto/create-service-sale.dto';
import { UpdateServiceSaleDto } from './dto/update-service-sale.dto';

@Injectable()
export class ServiceSaleService {
  private readonly logger = new Logger('ServiceSaleService');

  constructor(private readonly prisma: PrismaService) {}

  /* ---------- helpers ---------- */
  private ensureNonNegative(val: unknown, fieldLabel: string) {
    if (val === undefined || val === null) return;
    const n = typeof val === 'string' ? Number(val) : (val as number);
    if (Number.isNaN(n) || n < 0) {
      this.logger.warn(`Validation failed: ${fieldLabel} must be >= 0`);
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: `${fieldLabel} debe ser mayor o igual a 0.`,
        data: null,
      });
    }
  }

  /* ---------- CREATE ---------- */
  async create(dto: CreateServiceSaleDto) {
    this.logger.log(`Creating service sale: ${JSON.stringify(dto)}`);

    this.ensureNonNegative(dto.amount, 'El monto');

    const sale = await this.prisma.serviceSale.create({ data: dto });
    if (!sale) {
      this.logger.error('Failed to create service sale');
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'No se pudo crear la venta de servicio.',
        data: null,
      });
    }

    this.logger.log(`ServiceSale created id=${sale.serviceSaleId}`);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Venta de servicio creada exitosamente.',
      data: sale,
    };
  }

  /* ---------- FIND ALL ---------- */
  async findAll() {
    this.logger.log('Fetching service sales list');
    const list = await this.prisma.serviceSale.findMany({
      orderBy: [{ createdAt: 'desc' }],
    });
    return {
      statusCode: HttpStatus.OK,
      message: 'Ventas de servicio obtenidas exitosamente.',
      data: list,
    };
  }

  /* ---------- FIND ONE ---------- */
  async findOne(serviceSaleId: number) {
    this.logger.log(`Fetching service sale id=${serviceSaleId}`);
    const row = await this.prisma.serviceSale.findUnique({
      where: { serviceSaleId },
    });
    if (!row) {
      this.logger.warn(`Service sale id=${serviceSaleId} not found`);
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Venta de servicio no encontrada.',
        data: null,
      });
    }
    return {
      statusCode: HttpStatus.OK,
      message: 'Venta de servicio obtenida exitosamente.',
      data: row,
    };
  }

  /* ---------- UPDATE ---------- */
  async update(serviceSaleId: number, dto: UpdateServiceSaleDto) {
    this.logger.log(
      `Updating service sale id=${serviceSaleId} payload=${JSON.stringify(dto)}`
    );

    // asegúrate de que exista
    await this.findOne(serviceSaleId);

    // validar monto >= 0 si viene en el payload
    this.ensureNonNegative(dto.amount, 'El monto');

    const updated = await this.prisma.serviceSale.update({
      where: { serviceSaleId },
      data: dto,
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Venta de servicio actualizada exitosamente.',
      data: updated,
    };
  }

  /* ---------- DELETE (hard) ---------- */
  async remove(serviceSaleId: number) {
    this.logger.log(`Deleting service sale id=${serviceSaleId}`);

    // asegúrate de que exista
    await this.findOne(serviceSaleId);

    const deleted = await this.prisma.serviceSale.delete({
      where: { serviceSaleId },
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Venta de servicio eliminada exitosamente.',
      data: deleted,
    };
  }
}
