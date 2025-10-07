import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCategoryResourceDto } from './dto/create-category-resource.dto';
import { UpdateCategoryResourceDto } from './dto/update-category-resource.dto';

@Injectable()
export class CategoryResourceService {
  private readonly logger = new Logger('CategoryResourceService');

  constructor(private readonly prismaService: PrismaService) {}

  /* ---------------- CREATE ---------------- */
  async create(createDto: CreateCategoryResourceDto) {
    this.logger.log(
      `Creating categoryResource with: ${JSON.stringify(createDto)}`
    );

    // Validar duplicado: mismo padre + mismo nombre (case-insensitive)
    const exists = await this.prismaService.categoryResource.findFirst({
      where: {
        parentCategoryId: createDto.parentCategoryId ?? null,
        name: { equals: createDto.name, mode: 'insensitive' },
      },
      select: { categoryResourceId: true },
    });

    if (exists) {
      this.logger.warn(
        `Duplicate category under same parent. name="${createDto.name}", parentId=${createDto.parentCategoryId ?? null}`
      );
      throw new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        message: 'Ya existe una categoría con ese nombre en el mismo padre.',
        data: null,
      });
    }

    const category = await this.prismaService.categoryResource.create({
      data: createDto,
    });

    if (!category) {
      this.logger.error('Failed to create categoryResource');
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'No se pudo crear la categoría.',
        data: null,
      });
    }

    this.logger.log(`CategoryResource created id=${category.categoryResourceId}`);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Categoría creada exitosamente.',
      data: category,
    };
  }

  /* ---------------- FIND ALL ---------------- */
  async findAll() {
    this.logger.log('Fetching all categoryResources');
    const list = await this.prismaService.categoryResource.findMany({
      orderBy: [{ parentCategoryId: 'asc' }, { name: 'asc' }],
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Categorías obtenidas exitosamente.',
      data: list,
    };
  }

  /* ---------------- FIND ONE ---------------- */
  async findOne(categoryResourceId: number) {
    this.logger.log(`Fetching categoryResource id=${categoryResourceId}`);

    const category = await this.prismaService.categoryResource.findUnique({
      where: { categoryResourceId },
    });

    if (!category) {
      this.logger.warn(`CategoryResource id=${categoryResourceId} not found`);
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Categoría no encontrada.',
        data: null,
      });
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Categoría obtenida exitosamente.',
      data: category,
    };
  }

  /* ---------------- UPDATE ---------------- */
  async update(
    categoryResourceId: number,
    updateDto: UpdateCategoryResourceDto,
  ) {
    this.logger.log(
      `Updating categoryResource id=${categoryResourceId} with: ${JSON.stringify(
        updateDto,
      )}`,
    );

    // Traer actual
    const currentWrap = await this.findOne(categoryResourceId);
    const current = currentWrap.data;

    // Determinar valores efectivos que quedarán después del update
    const nextName =
      updateDto.name !== undefined ? updateDto.name : current.name;
    const nextParentId =
      updateDto.parentCategoryId !== undefined
        ? updateDto.parentCategoryId
        : current.parentCategoryId;

    // Si cambia name o cambia parent, validar duplicado bajo el (nuevo) padre
    if (
      (updateDto.name &&
        updateDto.name.trim().toLowerCase() !== current.name.trim().toLowerCase()) ||
      (updateDto.parentCategoryId !== undefined &&
        (updateDto.parentCategoryId ?? null) !== (current.parentCategoryId ?? null))
    ) {
      const duplicate = await this.prismaService.categoryResource.findFirst({
        where: {
          parentCategoryId: nextParentId ?? null,
          name: { equals: nextName, mode: 'insensitive' },
          categoryResourceId: { not: categoryResourceId }, // excluir el mismo
        },
        select: { categoryResourceId: true },
      });

      if (duplicate) {
        this.logger.warn(
          `Duplicate on update. name="${nextName}", parentId=${nextParentId ?? null}, dupId=${duplicate.categoryResourceId}`
        );
        throw new ConflictException({
          statusCode: HttpStatus.CONFLICT,
          message: 'Ya existe una categoría con ese nombre en el mismo padre.',
          data: null,
        });
      }
    }

    const updated = await this.prismaService.categoryResource.update({
      where: { categoryResourceId },
      data: updateDto,
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Categoría actualizada exitosamente.',
      data: updated,
    };
  }
}
