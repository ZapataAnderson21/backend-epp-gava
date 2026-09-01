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
import { ListServiceSalesQueryDto } from './dto/list-service-sales-query.dto';
import { buildPaginatedData, getPaginationArgs } from 'src/common/pagination';
import { Currency, Prisma } from 'src/generated/prisma';

@Injectable()
export class ServiceSaleService {
  private readonly logger = new Logger('ServiceSaleService');

  constructor(private readonly prisma: PrismaService) {}

  /* ---------- helpers ---------- */
  private ensureNonNegative(val: number | undefined, fieldLabel: string) {
    if (val === undefined || val === null) return;
    if (!Number.isFinite(val) || val < 0) {
      this.logger.warn(`Validation failed: ${fieldLabel} must be >= 0`);
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: `${fieldLabel} debe ser mayor o igual a 0.`,
        data: null,
      });
    }
  }

  async create(dto: CreateServiceSaleDto) {
    this.logger.log(`Creating service sale: ${JSON.stringify(dto)}`);

    this.ensureNonNegative(dto.amount, 'El monto');

    const sale = await this.prisma.serviceSale.create({ data: dto });
    if (!sale) {
      this.logger.error('Failed to create service sale');
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'No se pudo crear el ingreso.',
        data: null,
      });
    }

    this.logger.log(`ServiceSale created id=${sale.serviceSaleId}`);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Ingreso creado exitosamente.',
      data: sale,
    };
  }

  async findAllByProject(projectId: number) {
    this.logger.log(`Fetching service sales for project ID: ${projectId}`);
    const list = await this.prisma.serviceSale.findMany({
      where: { projectId },
      orderBy: [{ createdAt: 'desc' }],
    });

    if (!list || list.length === 0) {
      this.logger.warn(`No service sales found for project ID: ${projectId}`);
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No se encontraron ingresos registrados.',
        data: null,
      });
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Ingresos obtenidos exitosamente.',
      data: list,
    };
  }

  async findPaginatedByProject(
    projectId: number,
    query: ListServiceSalesQueryDto,
  ) {
    const search = query.search?.trim();
    const where: Prisma.ServiceSaleWhereInput = {
      projectId,
      ...(query.currency ? { currency: query.currency } : {}),
      ...(search
        ? {
            OR: [
              { serviceName: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const { skip, take } = getPaginationArgs(query);
    const [items, totalItems] = await Promise.all([
      this.prisma.serviceSale.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { serviceSaleId: 'desc' }],
        skip,
        take,
      }),
      this.prisma.serviceSale.count({ where }),
    ]);

    return {
      statusCode: HttpStatus.OK,
      message: 'Ingresos obtenidos exitosamente.',
      data: buildPaginatedData(items, totalItems, query),
    };
  }

  async findOne(serviceSaleId: number) {
    this.logger.log(`Fetching service sale id=${serviceSaleId}`);
    const row = await this.prisma.serviceSale.findUnique({
      where: { serviceSaleId },
    });
    if (!row) {
      this.logger.warn(`Service sale id=${serviceSaleId} not found`);
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Ingreso no encontrado.',
        data: null,
      });
    }
    return {
      statusCode: HttpStatus.OK,
      message: 'Ingreso obtenido exitosamente.',
      data: row,
    };
  }

  async sumAllAmountsByProject(projectId: number) {
    this.logger.log(
      `Calculating total amount of all service sales for project ID: ${projectId}`,
    );
    const result = await this.prisma.serviceSale.aggregate({
      where: { projectId },
      _sum: { amount: true },
    });

    const total = result._sum.amount || 0;

    return {
      statusCode: HttpStatus.OK,
      message: 'Total de ingresos calculado exitosamente.',
      data: total,
    };
  }

  async sumAllAmountsByCurrency(projectId: number) {
    const totals = await this.prisma.serviceSale.groupBy({
      by: ['currency'],
      where: { projectId },
      _sum: { amount: true },
    });
    const amounts: Record<Currency, number> = {
      PEN: 0,
      USD: 0,
      EUR: 0,
    };
    totals.forEach((total) => {
      amounts[total.currency] = Number(total._sum.amount ?? 0);
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Totales de ingresos calculados exitosamente.',
      data: amounts,
    };
  }

  async update(serviceSaleId: number, dto: UpdateServiceSaleDto) {
    this.logger.log(
      `Updating service sale id=${serviceSaleId} payload=${JSON.stringify(dto)}`,
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
      message: 'Ingreso actualizado exitosamente.',
      data: updated,
    };
  }

  async remove(serviceSaleId: number) {
    this.logger.log(`Deleting service sale id=${serviceSaleId}`);

    // asegúrate de que exista
    await this.findOne(serviceSaleId);

    const deleted = await this.prisma.serviceSale.delete({
      where: { serviceSaleId },
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Ingreso eliminado exitosamente.',
      data: deleted,
    };
  }
}
