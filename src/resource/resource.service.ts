import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';

@Injectable()
export class ResourceService {
  private readonly logger = new Logger('ResourceService');

  constructor(private readonly prisma: PrismaService) {}

  private norm(v?: string | null) {
    return (v ?? '').trim();
  }

  async create(dto: CreateResourceDto) {
    this.logger.log(`Creating resource: ${JSON.stringify(dto)}`);

    // Validación de unicidad por (categoryResourceId, name) - case-insensitive
    const dup = await this.prisma.resource.findFirst({
      where: {
        categoryResourceId: dto.categoryResourceId,
        name: { equals: dto.name, mode: 'insensitive' },
      },
      select: { resourceId: true },
    });
    if (dup) {
      this.logger.warn(
        `Duplicate resource in category ${dto.categoryResourceId} with name "${dto.name}"`
      );
      throw new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        message: 'Ya existe un recurso con ese nombre en la misma categoría.',
        data: null,
      });
    }

    const resource = await this.prisma.resource.create({ data: dto });
    if (!resource) {
      this.logger.error('Failed to create resource');
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'No se pudo crear el recurso.',
        data: null,
      });
    }

    this.logger.log(`Resource created id=${resource.resourceId}`);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Recurso creado exitosamente.',
      data: resource,
    };
  }


  async findAll() {
    this.logger.log('Fetching resources (active only)');
    const list = await this.prisma.resource.findMany({
      where: { deletedAt: null },
      include: { categoryResource: true },
      orderBy: [{ categoryResourceId: 'asc' }, { name: 'asc' }],
    });

    if(!list || list.length === 0){
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No se han encontrado recursos.',
        data: [],
      };
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Recursos obtenidos exitosamente.',
      data: list,
    };
  }
  

  async findOne(resourceId: number) {
    this.logger.log(`Fetching resource id=${resourceId}`);
    const resource = await this.prisma.resource.findFirst({
      where: { 
        resourceId, 
        deletedAt: null
      },
      include: { 
        categoryResource: true
      },
    });
    if (!resource) {
      this.logger.warn(`Resource id=${resourceId} not found`);
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Recurso no encontrado.',
        data: null,
      });
    }
    return {
      statusCode: HttpStatus.OK,
      message: 'Recurso obtenido exitosamente.',
      data: resource,
    };
  }


  async findByCategoryResourceId(categoryResourceId: number) {
    this.logger.log(
      `Fetching resources by categoryResourceId=${categoryResourceId} (active only)`
    );
    const list = await this.prisma.resource.findMany({
      where: { categoryResourceId, deletedAt: null },
      orderBy: { name: 'asc' },
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Recursos por categoría obtenidos exitosamente.',
      data: list,
    };
  }

  
  async update(resourceId: number, dto: UpdateResourceDto) {
    this.logger.log(
      `Updating resource id=${resourceId} with: ${JSON.stringify(dto)}`
    );

    // Actual actual
    const currentWrap = await this.findOne(resourceId);
    const current = currentWrap.data;

    // Determinar valores finales
    const nextName =
      dto.name !== undefined ? dto.name : (current.name as string);
    const nextCategoryId =
      dto.categoryResourceId !== undefined
        ? dto.categoryResourceId
        : current.categoryResourceId;

    // Si cambia name o category, validar duplicado (excluyendo al propio)
    if (
      (dto.name &&
        this.norm(dto.name).toLowerCase() !==
          this.norm(current.name).toLowerCase()) ||
      (dto.categoryResourceId !== undefined &&
        dto.categoryResourceId !== current.categoryResourceId)
    ) {
      const dup = await this.prisma.resource.findFirst({
        where: {
          categoryResourceId: nextCategoryId,
          name: { equals: nextName, mode: 'insensitive' },
          resourceId: { not: resourceId },
        },
        select: { resourceId: true },
      });
      if (dup) {
        this.logger.warn(
          `Duplicate on update in category ${nextCategoryId} with name "${nextName}" (existing id=${dup.resourceId})`
        );
        throw new ConflictException({
          statusCode: HttpStatus.CONFLICT,
          message: 'Ya existe un recurso con ese nombre en la misma categoría.',
          data: null,
        });
      }
    }

    const updated = await this.prisma.resource.update({
      where: { resourceId },
      data: dto,
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Recurso actualizado exitosamente.',
      data: updated,
    };
  }

  
  async remove(resourceId: number) {
    this.logger.log(`Soft-deleting resource id=${resourceId}`);

    const exists = await this.prisma.resource.findFirst({
      where: { resourceId, deletedAt: null },
      select: { resourceId: true },
    });
    if (!exists) {
      this.logger.warn(`Resource id=${resourceId} not found or already deleted`);
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Recurso no encontrado.',
        data: null,
      });
    }

    const deleted = await this.prisma.resource.update({
      where: { resourceId },
      data: { deletedAt: new Date() },
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Recurso eliminado exitosamente.',
      data: deleted,
    };
  }

  
  async restore(resourceId: number) {
    this.logger.log(`Restoring resource id=${resourceId}`);

    const exists = await this.prisma.resource.findFirst({
      where: { resourceId, deletedAt: { not: null } },
      select: { resourceId: true, name: true, categoryResourceId: true },
    });
    if (!exists) {
      this.logger.warn(`Resource id=${resourceId} not found as deleted`);
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Recurso no encontrado o no está eliminado.',
        data: null,
      });
    }

    // Verificar que al restaurar no rompa la unicidad (por si ya crearon otro igual)
    const dup = await this.prisma.resource.findFirst({
      where: {
        categoryResourceId: exists.categoryResourceId,
        name: { equals: exists.name, mode: 'insensitive' },
        resourceId: { not: resourceId },
      },
      select: { resourceId: true },
    });
    if (dup) {
      this.logger.warn(
        `Restore would violate unique (category=${exists.categoryResourceId}, name="${exists.name}")`
      );
      throw new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        message:
          'No se puede restaurar: ya existe un recurso con ese nombre en la misma categoría.',
        data: null,
      });
    }

    const restored = await this.prisma.resource.update({
      where: { resourceId },
      data: { deletedAt: null },
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Recurso restaurado exitosamente.',
      data: restored,
    };
  }
}
