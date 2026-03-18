import {
  BadRequestException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { QuotationStatus } from './enum';

@Injectable()
export class QuotationService {
  private readonly logger = new Logger('QuotationService');

  constructor(private readonly prisma: PrismaService) {}

  private formatQuotationCode(sequence: number, year: number) {
    const formatted = String(sequence).padStart(3, '0');
    return `No ${formatted}-${year} / GAVA`;
  }

  private getYearBounds(date: Date) {
    const year = date.getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);
    return { year, start, end };
  }

  async create(dto: CreateQuotationDto) {
    this.logger.log(`Creating quotation: ${JSON.stringify(dto)}`);

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Debe registrar al menos un item.',
        data: null,
      });
    }

    const items = dto.items.map((item, index) => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new BadRequestException({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'La cantidad debe ser mayor a 0.',
          data: null,
        });
      }

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new BadRequestException({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'El precio unitario debe ser mayor o igual a 0.',
          data: null,
        });
      }

      const lineTotal = Number((quantity * unitPrice).toFixed(2));
      const orderNumber = item.orderNumber ?? index + 1;

      return {
        description: item.description,
        unit: item.unit,
        quantity,
        unitPrice,
        lineTotal,
        orderNumber,
      };
    });

    const costDirectAmount = Number(
      items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2)
    );
    const igvRate = 0.18;
    const igvAmount = Number((costDirectAmount * igvRate).toFixed(2));
    const totalAmount = Number((costDirectAmount + igvAmount).toFixed(2));

    const tempCode = `TEMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const quotation = await this.prisma.quotation.create({
      data: {
        code: tempCode,
        serviceDescription: dto.serviceDescription,
        clientId: dto.clientId,
        status: QuotationStatus.Draft,
        commercialTerms: dto.commercialTerms,
        costDirectAmount,
        igvRate,
        igvAmount,
        totalAmount,
        items: {
          create: items,
        },
      },
      include: {
        client: true,
        items: {
          orderBy: [{ orderNumber: 'asc' }, { createdAt: 'desc' }],
        },
      },
    });

    const { year, start, end } = this.getYearBounds(quotation.createdAt);
    const sequence = await this.prisma.quotation.count({
      where: {
        createdAt: {
          gte: start,
          lt: end,
        },
      },
    });
    const code = this.formatQuotationCode(sequence, year);

    const updatedQuotation = await this.prisma.quotation.update({
      where: { quotationId: quotation.quotationId },
      data: { code },
      include: {
        client: true,
        items: {
          orderBy: [{ orderNumber: 'asc' }, { createdAt: 'desc' }],
        },
      },
    });

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Cotizacion creada exitosamente.',
      data: updatedQuotation,
    };
  }

  async findAll(filters?: { clientId?: string; status?: QuotationStatus }) {
    this.logger.log('Fetching all quotations'); 
    const where: { clientId?: number; status?: QuotationStatus } = {};

    if (filters?.clientId) {
      const clientId = Number(filters.clientId);
      if (!Number.isInteger(clientId) || clientId <= 0) {
        throw new BadRequestException({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'clientId debe ser un entero positivo.',
          data: null,
        });
      }
      where.clientId = clientId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    const quotations = await this.prisma.quotation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        client: true,
        items: {
          orderBy: [{ orderNumber: 'asc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (!quotations || quotations.length === 0) {
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No se encontraron cotizaciones.',
        data: [],
      });
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Cotizaciones obtenidas exitosamente.',
      data: quotations,
    };
  }

  async findOne(quotationId: number) {
    this.logger.log(`Fetching quotation id=${quotationId}`);
    const quotation = await this.prisma.quotation.findUnique({
      where: { quotationId },
      include: {
        client: true,
        items: {
          orderBy: [{ orderNumber: 'asc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (!quotation) {
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Cotizacion no encontrada.',
        data: null,
      });
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Cotizacion obtenida exitosamente.',
      data: quotation,
    };
  }

  async update(quotationId: number, dto: UpdateQuotationDto) {
    this.logger.log(
      `Updating quotation id=${quotationId} payload=${JSON.stringify(dto)}`
    );

    const existing = await this.prisma.quotation.findUnique({
      where: { quotationId },
    });

    if (!existing) {
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Cotizacion no encontrada.',
        data: null,
      });
    }

    const data: {
      code?: string;
      serviceDescription?: string;
      clientId?: number;
      status?: QuotationStatus;
      commercialTerms?: string | null;
      costDirectAmount?: number;
      igvRate?: number;
      igvAmount?: number;
      totalAmount?: number;
      items?: {
        deleteMany: object;
        create: Array<{
          description: string;
          unit: string;
          quantity: number;
          unitPrice: number;
          lineTotal: number;
          orderNumber: number;
        }>;
      };
    } = {};
    
    if (dto.serviceDescription !== undefined) {
      data.serviceDescription = dto.serviceDescription;
    }
    if (dto.clientId !== undefined) data.clientId = dto.clientId;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.commercialTerms !== undefined) {
      data.commercialTerms = dto.commercialTerms ?? null;
    }

    if (dto.items) {
      if (dto.items.length === 0) {
        throw new BadRequestException({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Debe registrar al menos un item.',
          data: null,
        });
      }

      const items = dto.items.map((item, index) => {
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);

        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new BadRequestException({
            statusCode: HttpStatus.BAD_REQUEST,
            message: 'La cantidad debe ser mayor a 0.',
            data: null,
          });
        }

        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          throw new BadRequestException({
            statusCode: HttpStatus.BAD_REQUEST,
            message: 'El precio unitario debe ser mayor o igual a 0.',
            data: null,
          });
        }

        const lineTotal = Number((quantity * unitPrice).toFixed(2));
        const orderNumber = item.orderNumber ?? index + 1;

        return {
          description: item.description,
          unit: item.unit,
          quantity,
          unitPrice,
          lineTotal,
          orderNumber,
        };
      });

      const costDirectAmount = Number(
        items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2)
      );
      const igvRate = 0.18;
      const igvAmount = Number((costDirectAmount * igvRate).toFixed(2));
      const totalAmount = Number((costDirectAmount + igvAmount).toFixed(2));

      data.costDirectAmount = costDirectAmount;
      data.igvRate = igvRate;
      data.igvAmount = igvAmount;
      data.totalAmount = totalAmount;
      data.items = {
        deleteMany: {},
        create: items,
      };
    }

    const updated = await this.prisma.quotation.update({
      where: { quotationId },
      data,
      include: {
        client: true,
        items: {
          orderBy: [{ orderNumber: 'asc' }, { createdAt: 'desc' }],
        },
      },
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Cotizacion actualizada exitosamente.',
      data: updated,
    };
  }
}
