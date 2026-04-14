import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ElementControlType,
  ElementControlTypeLabelEs,
  ElementFamily,
  ElementFamilyControlType,
  ElementFamilyLabelEs,
  ElementFamilyRequiresCode,
  ElementType,
  ElementTypeLabelEs,
} from './enum/element-type.enum';
import { CreateElementDto } from './dto/create-element.dto';
import { UpdateElementDto } from './dto/update-element.dto';

@Injectable()
export class ElementService {
  private readonly logger = new Logger('ElementService');

  constructor(private readonly prismaService: PrismaService) {}

  private normalizeOptionalText(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private isElementFamily(value?: string | null): value is ElementFamily {
    return !!value && Object.values(ElementFamily).includes(value as ElementFamily);
  }

  private isElementType(value?: string | null): value is ElementType {
    return !!value && Object.values(ElementType).includes(value as ElementType);
  }

  private isElementControlType(
    value?: string | null,
  ): value is ElementControlType {
    return (
      !!value &&
      Object.values(ElementControlType).includes(value as ElementControlType)
    );
  }

  private resolveLegacyType(
    family?: string | null,
    type?: string | null,
  ) {
    if (type && this.isElementType(type)) {
      return type;
    }

    if (!family) {
      return null;
    }

    return family === ElementFamily.Epp || family === ElementFamily.Epi
      ? ElementType.Epp
      : ElementType.Operative;
  }

  private resolveControlType(
    family?: string | null,
    controlType?: ElementControlType | null,
  ) {
    if (family) {
      return ElementFamilyControlType[family as ElementFamily];
    }

    if (controlType && this.isElementControlType(controlType)) {
      return controlType;
    }

    return ElementControlType.Returnable;
  }

  private buildElementView<T extends {
    category?: { name: string } | null;
    type: string;
    controlType: string;
    family?: string | null;
    deletedAt?: Date | null;
  }>(element: T) {
    const family = this.isElementFamily(element.family)
      ? (element.family as ElementFamily)
      : null;
    const isLegacy = !family;

    return {
      ...element,
      family,
      familyLabel: family ? ElementFamilyLabelEs[family] : 'Legado',
      isLegacy,
      typeLabel:
        ElementTypeLabelEs[element.type as ElementType] ?? element.type,
      controlTypeLabel:
        ElementControlTypeLabelEs[
          element.controlType as ElementControlType
        ] ?? element.controlType,
      isArchived: Boolean(element.deletedAt),
      legacyWarning: isLegacy
        ? 'Elemento legado conservado para compatibilidad e historial.'
        : null,
    };
  }

  private async resolveCategoryId(categoryName?: string | null) {
    const normalizedCategoryName = this.normalizeOptionalText(categoryName);

    if (!normalizedCategoryName) {
      return null;
    }

    const category = await this.prismaService.elementCategory.upsert({
      where: { name: normalizedCategoryName },
      update: { deletedAt: null },
      create: { name: normalizedCategoryName },
    });

    return category.elementCategoryId;
  }

  private buildLegacyFamilyWhere(family: ElementFamily) {
    switch (family) {
      case ElementFamily.Epp:
        return {
          family: null,
          type: ElementType.Epp,
          controlType: ElementControlType.Returnable,
        };
      case ElementFamily.Epi:
        return {
          family: null,
          type: ElementType.Epp,
          controlType: ElementControlType.Individual,
        };
      case ElementFamily.Ese:
        return {
          family: null,
          type: ElementType.Operative,
          controlType: ElementControlType.Returnable,
        };
      case ElementFamily.Measurement:
        return {
          family: null,
          type: ElementType.Operative,
          controlType: ElementControlType.Individual,
        };
      case ElementFamily.Consumible:
        return {
          family: null,
          type: ElementType.Operative,
          controlType: ElementControlType.Consumable,
        };
      default:
        return null;
    }
  }

  private async ensureNameIsAvailable(name: string, elementId?: number) {
    const conflictingElements = await this.prismaService.element.findMany({
      where: {
        name: name.trim(),
        deletedAt: null,
      },
    });

    const hasConflict = conflictingElements.some(
      (element) => element.elementId !== elementId,
    );

    if (hasConflict) {
      throw new ConflictException('Ya existe un elemento con este nombre.');
    }
  }

  private async ensureCodeIsAvailable(code: string, elementId?: number) {
    const conflicting = await this.prismaService.element.findUnique({
      where: { code },
    });

    if (conflicting && conflicting.elementId !== elementId) {
      throw new ConflictException('Ya existe un elemento con este codigo.');
    }
  }

  private async resolveElementPayload(
    dto: CreateElementDto | UpdateElementDto,
    currentElement?: {
      elementId: number;
      family: string | null;
      type: string | null;
      code: string | null;
    },
  ) {
    const hasFamily = Object.prototype.hasOwnProperty.call(dto, 'family');
    const hasType = Object.prototype.hasOwnProperty.call(dto, 'type');
    const hasControlType = Object.prototype.hasOwnProperty.call(
      dto,
      'controlType',
    );
    const hasCode = Object.prototype.hasOwnProperty.call(dto, 'code');

    const nextFamily = hasFamily
      ? (dto.family ?? null)
      : currentElement?.family ?? null;
    const nextType = hasType
      ? (dto.type ?? null)
      : currentElement?.type ?? null;
    const nextCode = hasCode
      ? this.normalizeOptionalText(dto.code)
      : currentElement?.code ?? null;
    const nextControlType = hasControlType
      ? (dto.controlType ?? null)
      : null;

    if (
      !nextFamily &&
      !nextType &&
      !currentElement &&
      !('family' in dto) &&
      !('type' in dto)
    ) {
      throw new BadRequestException(
        'Debes indicar un tipo legado o una familia de inventario.',
      );
    }

    const resolvedType = this.resolveLegacyType(nextFamily, nextType);
    const resolvedControlType = this.resolveControlType(
      nextFamily,
      nextControlType,
    );

    if (nextFamily && ElementFamilyRequiresCode[nextFamily] && !nextCode) {
      throw new BadRequestException(
        `La familia ${ElementFamilyLabelEs[nextFamily]} requiere codigo obligatorio.`,
      );
    }

    return {
      family: nextFamily,
      type: resolvedType,
      controlType: resolvedControlType,
      code: nextCode,
    };
  }

  async create(createElementDto: CreateElementDto) {
    this.logger.log('Creating element', JSON.stringify(createElementDto));

    const normalizedCode = this.normalizeOptionalText(createElementDto.code);
    const resolved = await this.resolveElementPayload(createElementDto);

    if (!resolved.family && !resolved.type) {
      throw new BadRequestException(
        'Debes indicar un tipo legado o una familia de inventario.',
      );
    }

    if (resolved.family && ElementFamilyRequiresCode[resolved.family] && !normalizedCode) {
      throw new BadRequestException(
        `La familia ${ElementFamilyLabelEs[resolved.family]} requiere codigo obligatorio.`,
      );
    }

    await this.ensureNameIsAvailable(createElementDto.name);

    if (normalizedCode) {
      await this.ensureCodeIsAvailable(normalizedCode);
    }

    const elementCategoryId = await this.resolveCategoryId(
      createElementDto.categoryName,
    );

    const element = await this.prismaService.element.create({
      data: {
        name: createElementDto.name.trim(),
        code: normalizedCode,
        description: createElementDto.description?.trim(),
        type: resolved.type as any,
        family: resolved.family as any,
        controlType: resolved.controlType as any,
        elementCategoryId,
      },
      include: {
        category: true,
      },
    });

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Elemento registrado exitosamente.',
      data: this.buildElementView(element),
    };
  }

  async findAll() {
    const foundElements = await this.prismaService.element.findMany({
      where: { deletedAt: null },
      include: {
        category: true,
      },
      orderBy: { name: 'asc' },
    });

    return {
      statusCode: foundElements.length ? HttpStatus.OK : HttpStatus.NOT_FOUND,
      message: foundElements.length
        ? 'Elementos encontrados exitosamente.'
        : 'No se han encontrado elementos.',
      data: foundElements.map((element) => this.buildElementView(element)),
    };
  }

  async findOne(elementId: number) {
    const foundElement = await this.prismaService.element.findFirst({
      where: {
        elementId,
      },
      include: {
        category: true,
      },
    });

    if (!foundElement) {
      throw new NotFoundException('Elemento no encontrado.');
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Elemento encontrado exitosamente.',
      data: this.buildElementView(foundElement),
    };
  }

  async findByName(name: string) {
    return await this.prismaService.element.findMany({
      where: {
        name: name.trim(),
        deletedAt: null,
      },
    });
  }

  async findAllByType(type: ElementType) {
    if (!this.isElementType(type)) {
      throw new BadRequestException('Selecciona un tipo valido.');
    }

    const foundElements = await this.prismaService.element.findMany({
      where: {
        type,
        deletedAt: null,
      },
      include: {
        category: true,
      },
      orderBy: { name: 'asc' },
    });

    return {
      statusCode: foundElements.length ? HttpStatus.OK : HttpStatus.NOT_FOUND,
      message: foundElements.length
        ? 'Elementos encontrados exitosamente.'
        : 'No se han encontrado elementos de este tipo.',
      data: foundElements.map((element) => this.buildElementView(element)),
    };
  }

  async findAllByFamily(family: ElementFamily) {
    if (!this.isElementFamily(family)) {
      throw new BadRequestException('Selecciona una familia valida.');
    }

    const legacyFamilyWhere = this.buildLegacyFamilyWhere(family);

    const foundElements = await this.prismaService.element.findMany({
      where: {
        OR: [
          { family },
          ...(legacyFamilyWhere ? [legacyFamilyWhere] : []),
        ],
        deletedAt: null,
      },
      include: {
        category: true,
      },
      orderBy: { name: 'asc' },
    });

    return {
      statusCode: foundElements.length ? HttpStatus.OK : HttpStatus.NOT_FOUND,
      message: foundElements.length
        ? 'Elementos encontrados exitosamente.'
        : 'No se han encontrado elementos de esta familia.',
      data: foundElements.map((element) => this.buildElementView(element)),
    };
  }

  async findAllLegacy() {
    const foundElements = await this.prismaService.element.findMany({
      where: {
        family: null,
        deletedAt: null,
      },
      include: {
        category: true,
      },
      orderBy: { name: 'asc' },
    });

    return {
      statusCode: foundElements.length ? HttpStatus.OK : HttpStatus.NOT_FOUND,
      message: foundElements.length
        ? 'Elementos legados encontrados exitosamente.'
        : 'No se han encontrado elementos legados.',
      data: foundElements.map((element) => this.buildElementView(element)),
    };
  }

  async update(elementId: number, updateElementDto: UpdateElementDto) {
    const existingElement = await this.prismaService.element.findFirst({
      where: { elementId, deletedAt: null },
    });

    if (!existingElement) {
      throw new NotFoundException('Elemento no encontrado.');
    }

    if (
      updateElementDto.type &&
      !this.isElementType(updateElementDto.type)
    ) {
      throw new BadRequestException('Selecciona un tipo valido.');
    }

    if (
      updateElementDto.family &&
      !this.isElementFamily(updateElementDto.family)
    ) {
      throw new BadRequestException('Selecciona una familia valida.');
    }

    if (
      updateElementDto.controlType &&
      !this.isElementControlType(updateElementDto.controlType)
    ) {
      throw new BadRequestException('Selecciona un tipo de control valido.');
    }

    if (updateElementDto.name) {
      await this.ensureNameIsAvailable(updateElementDto.name, elementId);
    }

    const normalizedCode = Object.prototype.hasOwnProperty.call(
      updateElementDto,
      'code',
    )
      ? this.normalizeOptionalText(updateElementDto.code)
      : existingElement.code;

    const resolved = await this.resolveElementPayload(updateElementDto, {
      elementId: existingElement.elementId,
      family: existingElement.family,
      type: existingElement.type,
      code: existingElement.code,
    });

    const nextFamily = Object.prototype.hasOwnProperty.call(
      updateElementDto,
      'family',
    )
      ? resolved.family
      : existingElement.family;

    if (resolved.family && ElementFamilyRequiresCode[resolved.family] && !normalizedCode) {
      throw new BadRequestException(
        `La familia ${ElementFamilyLabelEs[resolved.family]} requiere codigo obligatorio.`,
      );
    }

    if (normalizedCode) {
      await this.ensureCodeIsAvailable(normalizedCode, elementId);
    }

    const data: {
      name?: string;
      code?: string | null;
      description?: string;
      type?: ElementType;
      family?: ElementFamily | null;
      controlType?: ElementControlType;
      elementCategoryId?: number | null;
    } = {};

    if (Object.prototype.hasOwnProperty.call(updateElementDto, 'name')) {
      data.name = updateElementDto.name?.trim();
    }

    if (Object.prototype.hasOwnProperty.call(updateElementDto, 'code')) {
      data.code = normalizedCode;
    }

    if (Object.prototype.hasOwnProperty.call(updateElementDto, 'description')) {
      data.description = updateElementDto.description?.trim();
    }

    if (
      Object.prototype.hasOwnProperty.call(updateElementDto, 'family') ||
      Object.prototype.hasOwnProperty.call(updateElementDto, 'type')
    ) {
      data.family = nextFamily as any;
      data.type = resolved.type as any;
      data.controlType = resolved.controlType as any;
    } else if (Object.prototype.hasOwnProperty.call(updateElementDto, 'controlType')) {
      data.controlType = resolved.controlType as any;
    }

    if (
      Object.prototype.hasOwnProperty.call(updateElementDto, 'categoryName')
    ) {
      data.elementCategoryId = await this.resolveCategoryId(
        updateElementDto.categoryName,
      );
    }

    const updatedElement = await this.prismaService.element.update({
      where: { elementId },
      data,
      include: {
        category: true,
      },
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Elemento actualizado exitosamente.',
      data: this.buildElementView(updatedElement),
    };
  }

  async remove(elementId: number) {
    const existingElement = await this.prismaService.element.findFirst({
      where: { elementId },
      include: {
        _count: {
          select: {
            elementRequests: true,
            projectInventoryEntries: true,
            inventoryMovements: true,
          },
        },
      },
    });

    if (!existingElement) {
      throw new NotFoundException('Elemento no encontrado.');
    }

    const deletedElement = await this.prismaService.element.update({
      where: { elementId },
      data: { deletedAt: new Date() },
      include: {
        category: true,
      },
    });

    const hasHistory =
      existingElement._count.elementRequests > 0 ||
      existingElement._count.projectInventoryEntries > 0 ||
      existingElement._count.inventoryMovements > 0;

    return {
      statusCode: HttpStatus.OK,
      message: hasHistory
        ? 'Elemento archivado exitosamente. Conserva su historial para no romper requerimientos ni movimientos previos.'
        : 'Elemento eliminado exitosamente.',
      warning: hasHistory
        ? 'Este elemento se mantuvo en la base como historial compatible.'
        : null,
      data: this.buildElementView(deletedElement),
    };
  }
}
