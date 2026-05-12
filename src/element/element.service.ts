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
import { CreateFallProtectionGroupDto } from './dto/create-fall-protection-group.dto';

@Injectable()
export class ElementService {
  private readonly logger = new Logger('ElementService');
  private readonly elementCatalogInclude = {
    category: true,
    variants: {
      where: { deletedAt: null },
      orderBy: [{ normalizedLabel: 'asc' as const }],
    },
    inventoryAssets: {
      where: { deletedAt: null },
      select: {
        inventoryAssetId: true,
        status: true,
      },
    },
  };

  constructor(private readonly prismaService: PrismaService) {}

  private normalizeOptionalText(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private normalizeOptionalDate(value?: string | null) {
    if (!value) {
      return null;
    }

    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  private getDeprecatedVariantLabels(
    dto: CreateElementDto | UpdateElementDto,
  ) {
    return (dto as { variantLabels?: string[] | null }).variantLabels;
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

    return family === ElementFamily.Epp ||
      family === ElementFamily.Epi ||
      family === ElementFamily.Uniform
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

  private supportsVariants() {
    return false;
  }

  private supportsStockMinimum(family?: ElementFamily | null) {
    return (
      family === ElementFamily.Epp ||
      family === ElementFamily.Epi ||
      family === ElementFamily.Uniform
    );
  }

  private normalizeVariantLabels(variantLabels?: string[] | null) {
    if (!variantLabels?.length) {
      return [];
    }

    const normalizedMap = new Map<string, string>();

    for (const rawValue of variantLabels) {
      const trimmed = rawValue?.trim();
      if (!trimmed) {
        continue;
      }

      const normalizedLabel = trimmed.toUpperCase();
      normalizedMap.set(normalizedLabel, normalizedLabel);
    }

    return [...normalizedMap.entries()].map(([normalizedLabel, label]) => ({
      label,
      normalizedLabel,
    }));
  }

  private buildAssetSummary(
    inventoryAssets?: Array<{ status: string }>,
  ) {
    const totalAssets = inventoryAssets?.length ?? 0;
    const availableAssets =
      inventoryAssets?.filter((asset) => asset.status === 'available').length ?? 0;
    const assignedAssets =
      inventoryAssets?.filter((asset) => asset.status === 'assigned').length ?? 0;
    const maintenanceAssets =
      inventoryAssets?.filter((asset) => asset.status === 'in_maintenance')
        .length ?? 0;
    const retiredAssets =
      inventoryAssets?.filter((asset) => asset.status === 'retired').length ?? 0;

    return {
      totalAssets,
      availableAssets,
      assignedAssets,
      maintenanceAssets,
      retiredAssets,
    };
  }

  private buildElementView<T extends {
    category?: { name: string } | null;
    type: string;
    controlType: string;
    family?: string | null;
    deletedAt?: Date | null;
    variants?: Array<{
      elementVariantId: number;
      label: string;
      normalizedLabel: string;
      code?: string | null;
      description?: string | null;
    }>;
    inventoryAssets?: Array<{ inventoryAssetId: number; status: string }>;
  }>(element: T) {
    const family = this.isElementFamily(element.family)
      ? (element.family as ElementFamily)
      : null;
    const isLegacy = !family;
    const variants: Array<{
      elementVariantId: number;
      label: string;
      normalizedLabel: string;
      code?: string | null;
      description?: string | null;
    }> = [];
    const assetSummary = this.buildAssetSummary(element.inventoryAssets);

    return {
      ...element,
      family,
      categoryName: element.category?.name ?? null,
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
      supportsVariants: this.supportsVariants(),
      variants,
      variantCount: variants.length,
      assetSummary,
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

  private normalizeCategoryText(value?: string | null) {
    return value
      ?.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase() ?? '';
  }

  private async ensureFallProtectionPart(
    elementId: number,
    expectedCategory: 'arnes' | 'banda' | 'linea' | 'eslinga',
  ) {
    const element = await this.prismaService.element.findFirst({
      where: {
        elementId,
        deletedAt: null,
        family: ElementFamily.Harness,
      },
      include: { category: true },
    });

    if (!element) {
      throw new BadRequestException(
        `El elemento EPA ${elementId} no existe o no pertenece a proteccion anticaida.`,
      );
    }

    const categoryName = this.normalizeCategoryText(
      element.category?.name || element.name,
    );
    const matchesCategory =
      (expectedCategory === 'arnes' && categoryName.includes('arnes')) ||
      (expectedCategory === 'banda' && categoryName.includes('banda')) ||
      (expectedCategory === 'linea' && categoryName.includes('linea')) ||
      (expectedCategory === 'eslinga' && categoryName.includes('eslinga'));

    if (!matchesCategory) {
      throw new BadRequestException(
        `El elemento ${element.code ?? element.name} no corresponde a la categoria requerida del grupo EPA.`,
      );
    }

    return element;
  }

  private fallProtectionGroupInclude() {
    return {
      harnessElement: { include: { category: true } },
      anchorBandElement: { include: { category: true } },
      lifelineElement: { include: { category: true } },
      positioningLanyardElement: { include: { category: true } },
    };
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
      case ElementFamily.Uniform:
        return {
          family: null,
          type: ElementType.Epp,
          controlType: ElementControlType.Consumable,
        };
      case ElementFamily.Ese:
        return {
          family: null,
          type: ElementType.Operative,
          controlType: ElementControlType.Returnable,
        };
      case ElementFamily.Harness:
        return null;
      case ElementFamily.Measurement:
        return {
          family: null,
          type: ElementType.Operative,
          controlType: ElementControlType.Individual,
        };
      default:
        return null;
    }
  }

  async createFallProtectionGroup(dto: CreateFallProtectionGroupDto) {
    const normalizedCode = dto.code.trim();

    await Promise.all([
      this.ensureFallProtectionPart(dto.harnessElementId, 'arnes'),
      this.ensureFallProtectionPart(dto.anchorBandElementId, 'banda'),
      this.ensureFallProtectionPart(dto.lifelineElementId, 'linea'),
      this.ensureFallProtectionPart(dto.positioningLanyardElementId, 'eslinga'),
    ]);

    const uniquePartIds = new Set([
      dto.harnessElementId,
      dto.anchorBandElementId,
      dto.lifelineElementId,
      dto.positioningLanyardElementId,
    ]);

    if (uniquePartIds.size !== 4) {
      throw new BadRequestException(
        'Un grupo EPA debe tener cuatro elementos distintos.',
      );
    }

    const group = await this.prismaService.fallProtectionGroup.create({
      data: {
        code: normalizedCode,
        description: this.normalizeOptionalText(dto.description),
        harnessElementId: dto.harnessElementId,
        anchorBandElementId: dto.anchorBandElementId,
        lifelineElementId: dto.lifelineElementId,
        positioningLanyardElementId: dto.positioningLanyardElementId,
      },
      include: this.fallProtectionGroupInclude(),
    });

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Grupo EPA registrado exitosamente.',
      data: group,
    };
  }

  async findFallProtectionGroups() {
    const groups = await this.prismaService.fallProtectionGroup.findMany({
      where: { deletedAt: null },
      include: this.fallProtectionGroupInclude(),
      orderBy: { code: 'asc' },
    });

    return {
      statusCode: HttpStatus.OK,
      message: groups.length
        ? 'Grupos EPA encontrados exitosamente.'
        : 'No se han encontrado grupos EPA.',
      data: groups,
    };
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

  private shouldEnforceUniqueName(family?: string | null) {
    return family !== ElementFamily.Ese && family !== ElementFamily.Harness;
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

  private async syncElementVariants(
    tx: PrismaService,
    elementId: number,
    variantLabels?: string[] | null,
  ) {
    const normalizedVariants = this.normalizeVariantLabels(variantLabels);
    const existingVariants = await tx.elementVariant.findMany({
      where: { elementId },
    });

    const existingByNormalizedLabel = new Map(
      existingVariants.map((variant) => [variant.normalizedLabel, variant]),
    );
    const nextNormalizedLabels = new Set(
      normalizedVariants.map((variant) => variant.normalizedLabel),
    );

    for (const variant of normalizedVariants) {
      const existing = existingByNormalizedLabel.get(variant.normalizedLabel);

      if (existing) {
        await tx.elementVariant.update({
          where: { elementVariantId: existing.elementVariantId },
          data: {
            label: variant.label,
            normalizedLabel: variant.normalizedLabel,
            deletedAt: null,
          },
        });
        continue;
      }

      await tx.elementVariant.create({
        data: {
          elementId,
          label: variant.label,
          normalizedLabel: variant.normalizedLabel,
        },
      });
    }

    const variantsToArchive = existingVariants.filter(
      (variant) =>
        variant.deletedAt === null &&
        !nextNormalizedLabels.has(variant.normalizedLabel),
    );

    if (variantsToArchive.length) {
      await tx.elementVariant.updateMany({
        where: {
          elementVariantId: {
            in: variantsToArchive.map((variant) => variant.elementVariantId),
          },
        },
        data: {
          deletedAt: new Date(),
        },
      });
    }
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

    if (
      this.getDeprecatedVariantLabels(createElementDto)?.length
    ) {
      throw new BadRequestException(
        'Cada talla debe registrarse como un elemento independiente.',
      );
    }

    if (
      Number(createElementDto.stockMinimum ?? 0) > 0 &&
      !this.supportsStockMinimum(resolved.family as ElementFamily | null)
    ) {
      throw new BadRequestException(
        'El stock minimo solo aplica para EPP, EPI y Uniforme.',
      );
    }

    if (this.shouldEnforceUniqueName(resolved.family)) {
      await this.ensureNameIsAvailable(createElementDto.name);
    }

    if (normalizedCode) {
      await this.ensureCodeIsAvailable(normalizedCode);
    }

    const elementCategoryId = await this.resolveCategoryId(
      createElementDto.categoryName,
    );

    const element = await this.prismaService.$transaction(async (tx) => {
      const createdElement = await tx.element.create({
        data: {
          name: createElementDto.name.trim(),
          code: normalizedCode,
          description: createElementDto.description?.trim(),
          brand: this.normalizeOptionalText(createElementDto.brand),
          model: this.normalizeOptionalText(createElementDto.model),
          size: this.normalizeOptionalText(createElementDto.size),
          serialNumber: this.normalizeOptionalText(createElementDto.serialNumber),
          technicalSheetLink: this.normalizeOptionalText(
            createElementDto.technicalSheetLink,
          ),
          operationalStatus: this.normalizeOptionalText(
            createElementDto.operationalStatus,
          ),
          manufactureDate: this.normalizeOptionalDate(
            createElementDto.manufactureDate,
          ),
          expirationDate: this.normalizeOptionalDate(
            createElementDto.expirationDate,
          ),
          type: resolved.type as any,
          family: resolved.family as any,
          controlType: resolved.controlType as any,
          elementCategoryId,
          stockMinimum: this.supportsStockMinimum(resolved.family as ElementFamily | null)
            ? createElementDto.stockMinimum ?? 0
            : 0,
        },
      });

      return tx.element.findUniqueOrThrow({
        where: { elementId: createdElement.elementId },
        include: this.elementCatalogInclude,
      });
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
      include: this.elementCatalogInclude,
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
      include: this.elementCatalogInclude,
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
      include: this.elementCatalogInclude,
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
      include: this.elementCatalogInclude,
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
      include: this.elementCatalogInclude,
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

    if (updateElementDto.name && this.shouldEnforceUniqueName(nextFamily)) {
      await this.ensureNameIsAvailable(updateElementDto.name, elementId);
    }

    if (resolved.family && ElementFamilyRequiresCode[resolved.family] && !normalizedCode) {
      throw new BadRequestException(
        `La familia ${ElementFamilyLabelEs[resolved.family]} requiere codigo obligatorio.`,
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(updateElementDto, 'variantLabels') &&
      this.getDeprecatedVariantLabels(updateElementDto)?.length
    ) {
      throw new BadRequestException(
        'Cada talla debe registrarse como un elemento independiente.',
      );
    }

    if (
      Number(updateElementDto.stockMinimum ?? 0) > 0 &&
      !this.supportsStockMinimum(nextFamily as ElementFamily | null)
    ) {
      throw new BadRequestException(
        'El stock minimo solo aplica para EPP, EPI y Uniforme.',
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
      stockMinimum?: number;
      brand?: string | null;
      model?: string | null;
      size?: string | null;
      serialNumber?: string | null;
      technicalSheetLink?: string | null;
      operationalStatus?: string | null;
      manufactureDate?: Date | null;
      expirationDate?: Date | null;
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

    if (Object.prototype.hasOwnProperty.call(updateElementDto, 'brand')) {
      data.brand = this.normalizeOptionalText(updateElementDto.brand);
    }

    if (Object.prototype.hasOwnProperty.call(updateElementDto, 'model')) {
      data.model = this.normalizeOptionalText(updateElementDto.model);
    }

    if (Object.prototype.hasOwnProperty.call(updateElementDto, 'size')) {
      data.size = this.normalizeOptionalText(updateElementDto.size);
    }

    if (Object.prototype.hasOwnProperty.call(updateElementDto, 'serialNumber')) {
      data.serialNumber = this.normalizeOptionalText(updateElementDto.serialNumber);
    }

    if (Object.prototype.hasOwnProperty.call(updateElementDto, 'technicalSheetLink')) {
      data.technicalSheetLink = this.normalizeOptionalText(
        updateElementDto.technicalSheetLink,
      );
    }

    if (Object.prototype.hasOwnProperty.call(updateElementDto, 'operationalStatus')) {
      data.operationalStatus = this.normalizeOptionalText(
        updateElementDto.operationalStatus,
      );
    }

    if (Object.prototype.hasOwnProperty.call(updateElementDto, 'manufactureDate')) {
      data.manufactureDate = this.normalizeOptionalDate(
        updateElementDto.manufactureDate,
      );
    }

    if (Object.prototype.hasOwnProperty.call(updateElementDto, 'expirationDate')) {
      data.expirationDate = this.normalizeOptionalDate(
        updateElementDto.expirationDate,
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(updateElementDto, 'stockMinimum') ||
      Object.prototype.hasOwnProperty.call(updateElementDto, 'family')
    ) {
      data.stockMinimum = this.supportsStockMinimum(nextFamily as ElementFamily | null)
        ? Number(updateElementDto.stockMinimum ?? existingElement.stockMinimum ?? 0)
        : 0;
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

    const updatedElement = await this.prismaService.$transaction(async (tx) => {
      await tx.element.update({
        where: { elementId },
        data,
      });

      if (Object.prototype.hasOwnProperty.call(updateElementDto, 'variantLabels')) {
        await tx.elementVariant.updateMany({
          where: {
            elementId,
            deletedAt: null,
          },
          data: {
            deletedAt: new Date(),
          },
        });
      }

      return tx.element.findUniqueOrThrow({
        where: { elementId },
        include: this.elementCatalogInclude,
      });
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
            variants: true,
            inventoryAssets: true,
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
      existingElement._count.inventoryMovements > 0 ||
      existingElement._count.variants > 0 ||
      existingElement._count.inventoryAssets > 0;

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
