import { BadRequestException, ConflictException, NotFoundException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateWorkerGroupDto } from './dto/create-worker-group.dto';
import { UpdateWorkerGroupDto } from './dto/update-worker-group.dto';

@Injectable()
export class WorkerGroupService {
  private readonly logger = new Logger('WorkerGroupService');

  constructor(private readonly prismaService: PrismaService) {}

  /* ---------- Helpers ---------- */

  /** Ensures parent exists (if provided) */
  private async assertParentExists(parentGroupId: number | null) {
    if (parentGroupId == null) return;
    this.logger.debug(`Checking if parent group exists: ${parentGroupId}`);
    const exists = await this.prismaService.workerGroup.findUnique({
      where: { workerGroupId: parentGroupId },
      select: { workerGroupId: true },
    });
    if (!exists) {
      this.logger.warn(`Parent group ${parentGroupId} does not exist`);
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'El grupo padre no existe.',
        data: null,
      });
    }
  }

  /** Ensures no other group shares the same (name, parentGroupId) - case-insensitive */
  private async assertUniqueNameUnderParent(
    name: string,
    parentGroupId: number | null,
    excludeId?: number,
  ) {
    this.logger.debug(
      `Validating uniqueness for name="${name}" under parent=${parentGroupId ?? 'NULL'}${
        excludeId ? ` (excluding id=${excludeId})` : ''
      }`,
    );

    const duplicate = await this.prismaService.workerGroup.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' }, // evita "Operarios" vs "operarios"
        parentGroupId: parentGroupId ?? null,
        ...(excludeId ? { workerGroupId: { not: excludeId } } : {}),
      },
      select: { workerGroupId: true },
    });

    if (duplicate) {
      this.logger.warn(
        `Duplicate worker group detected: name="${name}", parent=${parentGroupId ?? 'NULL'} (existing id=${duplicate.workerGroupId})`,
      );
      throw new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        message:
          'Ya existe un Grupo de Trabajadores con ese nombre en el mismo padre.',
        data: null,
      });
    }
  }

  /** Maps unexpected create/update errors to friendly API errors */
  private handleCreateUpdateError(e: any, action: 'create' | 'update') {
    // Prisma P2002 = unique constraint violation
    if (e?.code === 'P2002') {
      this.logger.warn(
        `Unique constraint violation on ${action} (target: ${e?.meta?.target})`,
      );
      throw new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        message:
          'Ya existe un Grupo de Trabajadores con ese nombre en el mismo padre.',
        data: null,
      });
    }
    this.logger.error(`Unexpected error on ${action}: ${e?.message ?? e}`, e?.stack);
    throw new BadRequestException({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Ocurrió un error procesando la solicitud.',
      data: null,
    });
  }

  /* ---------- CRUD ---------- */

  async create(createWorkerGroupDto: CreateWorkerGroupDto) {
    this.logger.log(
      `Creating worker group with data: ${JSON.stringify(createWorkerGroupDto)}`,
    );

    const parentId = createWorkerGroupDto.parentGroupId ?? null;

    await this.assertParentExists(parentId);
    await this.assertUniqueNameUnderParent(createWorkerGroupDto.name, parentId);

    try {
      const workerGroup = await this.prismaService.workerGroup.create({
        data: { ...createWorkerGroupDto, parentGroupId: parentId },
      });

      this.logger.log(
        `Worker group created successfully (id=${workerGroup.workerGroupId})`,
      );
      return {
        statusCode: HttpStatus.CREATED,
        message: 'Grupo de Trabajadores registrado exitosamente.',
        data: workerGroup,
      };
    } catch (e) {
      return this.handleCreateUpdateError(e, 'create');
    }
  }

  async findAll() {
    this.logger.log('Fetching all worker groups');
    const data = await this.prismaService.workerGroup.findMany({
      orderBy: [{ parentGroupId: 'asc' }, { name: 'asc' }],
      include: {
        parentGroup: { select: { workerGroupId: true, name: true } },
      },
    });
    return {
      statusCode: HttpStatus.OK,
      message: 'Grupos de Trabajadores obtenidos.',
      data,
    };
  }

  async findOne(id: number) {
    this.logger.log(`Fetching worker group by id=${id}`);
    const data = await this.prismaService.workerGroup.findUnique({
      where: { workerGroupId: id },
      include: {
        parentGroup: { select: { workerGroupId: true, name: true } },
        subGroups: { select: { workerGroupId: true, name: true } },
      },
    });

    if (!data) {
      this.logger.warn(`Worker group id=${id} not found`);
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Grupo de Trabajadores no encontrado.',
        data: null,
      });
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Grupo de Trabajadores encontrado.',
      data,
    };
  }

  async update(id: number, updateWorkerGroupDto: UpdateWorkerGroupDto) {
    this.logger.log(
      `Updating worker group id=${id} with data: ${JSON.stringify(updateWorkerGroupDto)}`,
    );

    const current = await this.prismaService.workerGroup.findUnique({
      where: { workerGroupId: id },
    });

    if (!current) {
      this.logger.warn(`Worker group id=${id} not found for update`);
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Grupo de Trabajadores no encontrado.',
        data: null,
      });
    }

    // Prevent self-parenting
    if (
      updateWorkerGroupDto.parentGroupId !== undefined &&
      updateWorkerGroupDto.parentGroupId === id
    ) {
      this.logger.warn(`Attempt to set parentGroupId=self for id=${id}`);
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Un grupo no puede ser su propio padre.',
        data: null,
      });
    }

    const nextName = updateWorkerGroupDto.name ?? current.name;
    const nextParent =
      (updateWorkerGroupDto.parentGroupId !== undefined
        ? updateWorkerGroupDto.parentGroupId
        : current.parentGroupId) ?? null;

    await this.assertParentExists(nextParent);

    // Validate uniqueness when name/parent changes
    if (
      updateWorkerGroupDto.name !== undefined ||
      updateWorkerGroupDto.parentGroupId !== undefined
    ) {
      await this.assertUniqueNameUnderParent(nextName, nextParent, id);
    }

    try {
      const data = await this.prismaService.workerGroup.update({
        where: { workerGroupId: id },
        data: updateWorkerGroupDto,
      });

      this.logger.log(`Worker group id=${id} updated successfully`);
      return {
        statusCode: HttpStatus.OK,
        message: 'Grupo de Trabajadores actualizado exitosamente.',
        data,
      };
    } catch (e) {
      return this.handleCreateUpdateError(e, 'update');
    }
  }
}
