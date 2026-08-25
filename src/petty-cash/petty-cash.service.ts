import {
  BadRequestException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePettyCashDto } from './dto/create-petty-cash.dto';
import { UpdatePettyCashDto } from './dto/update-petty-cash.dto';
import { PettyCashLabelEs, PettyCashType } from './enum';
import { buildPaginatedData, getPaginationArgs } from 'src/common/pagination';
import { ListPettyCashesQueryDto } from './dto/list-petty-cashes-query.dto';

@Injectable()
export class PettyCashService {
  private readonly logger = new Logger('PettyCashService');

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
  async create(dto: CreatePettyCashDto) {
    this.logger.log(`Creating petty cash: ${JSON.stringify(dto)}`);

    this.ensureNonNegative(dto.amount, 'El monto');

    const pettyCashData = {
      ...dto,
      expenseDate: new Date(dto.expenseDate),
    };

    const pettyCash = await this.prisma.pettyCash.create({
      data: pettyCashData,
    });
    if (!pettyCash) {
      this.logger.error('Failed to create petty cash');
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'No se pudo crear la caja chica.',
        data: null,
      });
    }

    this.logger.log(`PettyCash created id=${pettyCash.pettyCashId}`);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Caja chica creada exitosamente.',
      data: pettyCash,
    };
  }

  /* ---------- FIND ALL ---------- */
  async findAllByProject(projectId: number) {
    this.logger.log(`Fetching petty cash list for project ID: ${projectId}`);
    const list = await this.prisma.pettyCash.findMany({
      where: { projectId },
      orderBy: [{ expenseDate: 'desc' }],
    });

    if (!list || list.length === 0) {
      this.logger.warn(
        `No petty cash entries found for project ID: ${projectId}`,
      );
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No se encontraron salidas de caja chica.',
        data: null,
      });
    }

    const proccessedList = list.map((item) => ({
      ...item,
      expenseDate: new Date(item.expenseDate).toLocaleDateString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'America/Lima',
      }),
      expenseType: PettyCashLabelEs[item.expenseType], // Convertir enum a string
    }));

    return {
      statusCode: HttpStatus.OK,
      message: 'Cajas chicas obtenidas exitosamente.',
      data: proccessedList,
    };
  }

  async findPaginatedByProject(
    projectId: number,
    query: ListPettyCashesQueryDto,
  ) {
    const search = query.search?.trim();
    const where = {
      projectId,
      ...(query.expenseType ? { expenseType: query.expenseType } : {}),
      ...(search
        ? {
            OR: [
              { description: { contains: search, mode: 'insensitive' as const } },
              { invoiceNumber: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const { skip, take } = getPaginationArgs(query);
    const [pettyCashes, totalItems] = await Promise.all([
      this.prisma.pettyCash.findMany({
        where,
        orderBy: [{ expenseDate: 'desc' }, { pettyCashId: 'desc' }],
        skip,
        take,
      }),
      this.prisma.pettyCash.count({ where }),
    ]);
    const items = pettyCashes.map((item) => ({
      ...item,
      expenseDate: new Date(item.expenseDate).toLocaleDateString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'America/Lima',
      }),
      expenseType: PettyCashLabelEs[item.expenseType],
    }));

    return {
      statusCode: HttpStatus.OK,
      message: 'Cajas chicas obtenidas exitosamente.',
      data: buildPaginatedData(items, totalItems, query),
    };
  }

  /* ---------- FIND ONE ---------- */
  async findOne(pettyCashId: number) {
    this.logger.log(`Fetching petty cash id=${pettyCashId}`);
    const row = await this.prisma.pettyCash.findUnique({
      where: { pettyCashId },
    });
    if (!row) {
      this.logger.warn(`Petty cash id=${pettyCashId} not found`);
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Caja chica no encontrada.',
        data: null,
      });
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Caja chica obtenida exitosamente.',
      data: row,
    };
  }

  /* ---------- SUM ---------- */
  async sumAllAmountsByProject(projectId: number) {
    this.logger.log(
      `Calculating total amount of all petty cash entries for project ID: ${projectId}`,
    );
    const result = await this.prisma.pettyCash.aggregate({
      where: { projectId },
      _sum: { amount: true },
    });

    const total = result._sum.amount || 0;

    return {
      statusCode: HttpStatus.OK,
      message: 'Total de salidas de caja chica calculado exitosamente.',
      data: total,
    };
  }

  async sumAmountsByTypeAndProject(
    projectId: number,
    pettyCashType: PettyCashType,
  ) {
    this.logger.log(
      `Calculating total amount of petty cash entries for project ID: ${projectId} and type: ${pettyCashType}`,
    );
    const result = await this.prisma.pettyCash.aggregate({
      where: { projectId, expenseType: pettyCashType },
      _sum: { amount: true },
    });

    const total = result._sum.amount || 0;

    return {
      statusCode: HttpStatus.OK,
      message: 'Total de salidas de caja chica calculado exitosamente.',
      data: total,
    };
  }

  /* ---------- UPDATE ---------- */
  async update(pettyCashId: number, dto: UpdatePettyCashDto) {
    this.logger.log(
      `Updating petty cash id=${pettyCashId} payload=${JSON.stringify(dto)}`,
    );

    // asegúrate de que exista
    await this.findOne(pettyCashId);

    // validar monto >= 0 si viene en el payload
    this.ensureNonNegative(dto.amount, 'El monto');

    const updated = await this.prisma.pettyCash.update({
      where: { pettyCashId },
      data: dto,
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Caja chica actualizada exitosamente.',
      data: updated,
    };
  }

  /* ---------- DELETE (hard) ---------- */
  async remove(pettyCashId: number) {
    this.logger.log(`Deleting petty cash id=${pettyCashId}`);

    // asegúrate de que exista
    await this.findOne(pettyCashId);

    const deleted = await this.prisma.pettyCash.delete({
      where: { pettyCashId },
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Caja chica eliminada exitosamente.',
      data: deleted,
    };
  }
}
