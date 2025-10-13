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

    const pettyCash = await this.prisma.pettyCash.create({ data: dto });
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
      orderBy: [{ createdAt: 'desc' }],
    });

    if (!list || list.length === 0) {
      this.logger.warn(`No petty cash entries found for project ID: ${projectId}`);
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No se encontraron salidas de caja chica.',
        data: null,
      });
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Cajas chicas obtenidas exitosamente.',
      data: list,
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

  /* ---------- UPDATE ---------- */
  async update(pettyCashId: number, dto: UpdatePettyCashDto) {
    this.logger.log(
      `Updating petty cash id=${pettyCashId} payload=${JSON.stringify(dto)}`
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
