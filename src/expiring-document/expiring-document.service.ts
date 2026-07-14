import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ExpiringDocumentAlertLevel,
  ExpiringDocumentHistoryAction,
  Prisma,
} from 'src/generated/prisma';
import { MailService } from 'src/mail/mail.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateExpiringDocumentCategoryDto } from './dto/create-expiring-document-category.dto';
import { CreateExpiringDocumentDto } from './dto/create-expiring-document.dto';
import { ListExpiringDocumentsQueryDto } from './dto/list-expiring-documents-query.dto';
import { UpdateExpiringDocumentCategoryDto } from './dto/update-expiring-document-category.dto';
import { UpdateExpiringDocumentDto } from './dto/update-expiring-document.dto';

const documentInclude = {
  category: true,
  createdBy: { select: { userId: true, name: true, lastName: true } },
  updatedBy: { select: { userId: true, name: true, lastName: true } },
} as const;

@Injectable()
export class ExpiringDocumentService {
  private readonly logger = new Logger(ExpiringDocumentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  private clean(value?: string | null) {
    const normalized = value?.trim();
    return normalized || null;
  }

  private dateOnly(value: string) {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }

  private todayUtc() {
    const lima = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    return this.dateOnly(lima);
  }

  private daysBetween(from: Date, to: Date) {
    return Math.round((to.getTime() - from.getTime()) / 86_400_000);
  }

  private statusFor(document: {
    expirationDate: Date;
    category: { alertDaysFirst: number };
  }): { status: 'expired' | 'upcoming' | 'valid'; daysRemaining: number } {
    const daysRemaining = this.daysBetween(
      this.todayUtc(),
      document.expirationDate,
    );
    const status =
      daysRemaining < 0
        ? 'expired'
        : daysRemaining <= document.category.alertDaysFirst
          ? 'upcoming'
          : 'valid';
    return { status, daysRemaining };
  }

  private mapDocument<
    T extends {
      expirationDate: Date;
      issueDate: Date | null;
      category: { alertDaysFirst: number };
    },
  >(document: T) {
    return { ...document, ...this.statusFor(document) };
  }

  private validateAlertDays(first: number, second: number, third: number) {
    if (!(first > second && second > third && third >= 0)) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message:
          'Los avisos deben estar en orden descendente, por ejemplo 30, 15 y 7 dias.',
        data: null,
      });
    }
  }

  private normalizeEmails(emails: string[] = []) {
    return [
      ...new Set(
        emails.map((email) => email.trim().toLowerCase()).filter(Boolean),
      ),
    ];
  }

  async createCategory(dto: CreateExpiringDocumentCategoryDto) {
    const name = dto.name.trim();
    const duplicate = await this.prisma.expiringDocumentCategory.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (duplicate)
      throw new ConflictException(
        'Ya existe una categoria documental con ese nombre.',
      );

    const first = dto.alertDaysFirst ?? 30;
    const second = dto.alertDaysSecond ?? 15;
    const third = dto.alertDaysThird ?? 7;
    this.validateAlertDays(first, second, third);
    const emails = this.normalizeEmails(dto.notificationEmails);
    const enabled = dto.emailNotificationsEnabled ?? true;
    if (enabled && emails.length === 0) {
      throw new BadRequestException(
        'Debe registrar al menos un destinatario si los correos estan habilitados.',
      );
    }

    const category = await this.prisma.expiringDocumentCategory.create({
      data: {
        name,
        description: this.clean(dto.description),
        alertDaysFirst: first,
        alertDaysSecond: second,
        alertDaysThird: third,
        notificationEmails: emails,
        emailNotificationsEnabled: enabled,
      },
    });
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Categoria creada exitosamente.',
      data: category,
    };
  }

  async listCategories(includeDeleted = false) {
    const categories = await this.prisma.expiringDocumentCategory.findMany({
      where: includeDeleted ? undefined : { deletedAt: null },
      include: {
        _count: { select: { documents: { where: { deletedAt: null } } } },
      },
      orderBy: { name: 'asc' },
    });
    return {
      statusCode: HttpStatus.OK,
      message: 'Categorias obtenidas exitosamente.',
      data: categories,
    };
  }

  async updateCategory(
    categoryId: number,
    dto: UpdateExpiringDocumentCategoryDto,
  ) {
    const current = await this.prisma.expiringDocumentCategory.findFirst({
      where: { expiringDocumentCategoryId: categoryId, deletedAt: null },
    });
    if (!current)
      throw new NotFoundException('Categoria documental no encontrada.');

    const name = dto.name?.trim() ?? current.name;
    const duplicate = await this.prisma.expiringDocumentCategory.findFirst({
      where: {
        expiringDocumentCategoryId: { not: categoryId },
        name: { equals: name, mode: 'insensitive' },
      },
    });
    if (duplicate)
      throw new ConflictException(
        'Ya existe una categoria documental con ese nombre.',
      );

    const first = dto.alertDaysFirst ?? current.alertDaysFirst;
    const second = dto.alertDaysSecond ?? current.alertDaysSecond;
    const third = dto.alertDaysThird ?? current.alertDaysThird;
    this.validateAlertDays(first, second, third);
    const emails = dto.notificationEmails
      ? this.normalizeEmails(dto.notificationEmails)
      : current.notificationEmails;
    const enabled =
      dto.emailNotificationsEnabled ?? current.emailNotificationsEnabled;
    if (enabled && emails.length === 0) {
      throw new BadRequestException(
        'Debe registrar al menos un destinatario si los correos estan habilitados.',
      );
    }

    const category = await this.prisma.expiringDocumentCategory.update({
      where: { expiringDocumentCategoryId: categoryId },
      data: {
        name,
        description:
          dto.description === undefined
            ? current.description
            : this.clean(dto.description),
        alertDaysFirst: first,
        alertDaysSecond: second,
        alertDaysThird: third,
        notificationEmails: emails,
        emailNotificationsEnabled: enabled,
      },
    });
    return {
      statusCode: HttpStatus.OK,
      message: 'Categoria actualizada exitosamente.',
      data: category,
    };
  }

  async deleteCategory(categoryId: number) {
    const activeDocuments = await this.prisma.expiringDocument.count({
      where: { categoryId, deletedAt: null },
    });
    if (activeDocuments > 0) {
      throw new ConflictException(
        'No se puede desactivar una categoria que tiene documentos activos.',
      );
    }
    const result = await this.prisma.expiringDocumentCategory.updateMany({
      where: { expiringDocumentCategoryId: categoryId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (!result.count)
      throw new NotFoundException('Categoria documental no encontrada.');
    return {
      statusCode: HttpStatus.OK,
      message: 'Categoria desactivada exitosamente.',
      data: null,
    };
  }

  async restoreCategory(categoryId: number) {
    const result = await this.prisma.expiringDocumentCategory.updateMany({
      where: {
        expiringDocumentCategoryId: categoryId,
        deletedAt: { not: null },
      },
      data: { deletedAt: null },
    });
    if (!result.count) {
      throw new NotFoundException(
        'Categoria documental archivada no encontrada.',
      );
    }
    return {
      statusCode: HttpStatus.OK,
      message: 'Categoria restaurada exitosamente.',
      data: null,
    };
  }

  private validateStorage(path?: string | null, description?: string | null) {
    if (!this.clean(path) && !this.clean(description)) {
      throw new BadRequestException(
        'Debe especificar una ruta o una descripcion de almacenamiento.',
      );
    }
  }

  private async ensureCategory(categoryId: number) {
    const category = await this.prisma.expiringDocumentCategory.findFirst({
      where: { expiringDocumentCategoryId: categoryId, deletedAt: null },
    });
    if (!category)
      throw new BadRequestException(
        'La categoria indicada no existe o esta inactiva.',
      );
    return category;
  }

  private snapshot(document: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(document)) as Prisma.InputJsonValue;
  }

  async createDocument(dto: CreateExpiringDocumentDto, userId: number) {
    await this.ensureCategory(dto.categoryId);
    this.validateStorage(dto.storagePath, dto.storageDescription);
    const issueDate = dto.issueDate ? this.dateOnly(dto.issueDate) : null;
    const expirationDate = this.dateOnly(dto.expirationDate);
    if (issueDate && issueDate > expirationDate) {
      throw new BadRequestException(
        'La fecha de emision no puede ser posterior al vencimiento.',
      );
    }

    const document = await this.prisma.$transaction(async (tx) => {
      const created = await tx.expiringDocument.create({
        data: {
          categoryId: dto.categoryId,
          title: dto.title.trim(),
          documentCode: this.clean(dto.documentCode),
          referenceType: dto.referenceType.trim(),
          referenceDescription: dto.referenceDescription.trim(),
          storageSpace: dto.storageSpace.trim(),
          storagePath: this.clean(dto.storagePath),
          storageDescription: this.clean(dto.storageDescription),
          issueDate,
          expirationDate,
          notes: this.clean(dto.notes),
          createdByUserId: userId,
          updatedByUserId: userId,
        },
        include: documentInclude,
      });
      await tx.expiringDocumentHistory.create({
        data: {
          expiringDocumentId: created.expiringDocumentId,
          changedByUserId: userId,
          action: ExpiringDocumentHistoryAction.created,
          snapshot: this.snapshot(created),
        },
      });
      return created;
    });
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Documento registrado exitosamente.',
      data: this.mapDocument(document),
    };
  }

  async listDocuments(query: ListExpiringDocumentsQueryDto) {
    const where: Prisma.ExpiringDocumentWhereInput = {
      ...(query.includeDeleted ? {} : { deletedAt: null }),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { documentCode: { contains: query.search, mode: 'insensitive' } },
              {
                referenceDescription: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              { storagePath: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    if (query.month && query.year) {
      where.expirationDate = {
        gte: new Date(Date.UTC(query.year, query.month - 1, 1)),
        lt: new Date(Date.UTC(query.year, query.month, 1)),
      };
    }

    const documents = await this.prisma.expiringDocument.findMany({
      where,
      include: documentInclude,
      orderBy: [{ expirationDate: 'asc' }, { title: 'asc' }],
    });
    const filtered = documents
      .map((document) => this.mapDocument(document))
      .filter((document) => !query.status || document.status === query.status);
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 50;
    return {
      statusCode: HttpStatus.OK,
      message: 'Documentos obtenidos exitosamente.',
      data: {
        items: filtered.slice(offset, offset + limit),
        total: filtered.length,
        limit,
        offset,
      },
    };
  }

  async getDocument(documentId: number) {
    const document = await this.prisma.expiringDocument.findUnique({
      where: { expiringDocumentId: documentId },
      include: documentInclude,
    });
    if (!document) throw new NotFoundException('Documento no encontrado.');
    return {
      statusCode: HttpStatus.OK,
      message: 'Documento obtenido exitosamente.',
      data: this.mapDocument(document),
    };
  }

  async updateDocument(
    documentId: number,
    dto: UpdateExpiringDocumentDto,
    userId: number,
  ) {
    const current = await this.prisma.expiringDocument.findFirst({
      where: { expiringDocumentId: documentId, deletedAt: null },
      include: documentInclude,
    });
    if (!current) throw new NotFoundException('Documento no encontrado.');
    if (dto.categoryId) await this.ensureCategory(dto.categoryId);

    const storagePath =
      dto.storagePath === undefined
        ? current.storagePath
        : this.clean(dto.storagePath);
    const storageDescription =
      dto.storageDescription === undefined
        ? current.storageDescription
        : this.clean(dto.storageDescription);
    this.validateStorage(storagePath, storageDescription);
    const issueDate =
      dto.issueDate === undefined
        ? current.issueDate
        : dto.issueDate
          ? this.dateOnly(dto.issueDate)
          : null;
    const expirationDate = dto.expirationDate
      ? this.dateOnly(dto.expirationDate)
      : current.expirationDate;
    if (issueDate && issueDate > expirationDate) {
      throw new BadRequestException(
        'La fecha de emision no puede ser posterior al vencimiento.',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const document = await tx.expiringDocument.update({
        where: { expiringDocumentId: documentId },
        data: {
          categoryId: dto.categoryId,
          title: dto.title?.trim(),
          documentCode:
            dto.documentCode === undefined
              ? undefined
              : this.clean(dto.documentCode),
          referenceType: dto.referenceType?.trim(),
          referenceDescription: dto.referenceDescription?.trim(),
          storageSpace: dto.storageSpace?.trim(),
          storagePath,
          storageDescription,
          issueDate,
          expirationDate,
          notes: dto.notes === undefined ? undefined : this.clean(dto.notes),
          updatedByUserId: userId,
        },
        include: documentInclude,
      });
      await tx.expiringDocumentHistory.create({
        data: {
          expiringDocumentId: documentId,
          changedByUserId: userId,
          action: ExpiringDocumentHistoryAction.updated,
          snapshot: this.snapshot(document),
        },
      });
      return document;
    });
    return {
      statusCode: HttpStatus.OK,
      message: 'Documento actualizado exitosamente.',
      data: this.mapDocument(updated),
    };
  }

  private async setDeleted(
    documentId: number,
    userId: number,
    deleted: boolean,
  ) {
    const current = await this.prisma.expiringDocument.findUnique({
      where: { expiringDocumentId: documentId },
    });
    if (!current || Boolean(current.deletedAt) !== !deleted) {
      throw new NotFoundException(
        'Documento no encontrado en el estado solicitado.',
      );
    }
    const document = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.expiringDocument.update({
        where: { expiringDocumentId: documentId },
        data: {
          deletedAt: deleted ? new Date() : null,
          updatedByUserId: userId,
        },
        include: documentInclude,
      });
      await tx.expiringDocumentHistory.create({
        data: {
          expiringDocumentId: documentId,
          changedByUserId: userId,
          action: deleted
            ? ExpiringDocumentHistoryAction.deleted
            : ExpiringDocumentHistoryAction.restored,
          snapshot: this.snapshot(updated),
        },
      });
      return updated;
    });
    return {
      statusCode: HttpStatus.OK,
      message: deleted
        ? 'Documento archivado exitosamente.'
        : 'Documento restaurado exitosamente.',
      data: this.mapDocument(document),
    };
  }

  deleteDocument(documentId: number, userId: number) {
    return this.setDeleted(documentId, userId, true);
  }

  restoreDocument(documentId: number, userId: number) {
    return this.setDeleted(documentId, userId, false);
  }

  async getHistory(documentId: number) {
    await this.getDocument(documentId);
    const history = await this.prisma.expiringDocumentHistory.findMany({
      where: { expiringDocumentId: documentId },
      include: {
        changedBy: { select: { userId: true, name: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return {
      statusCode: HttpStatus.OK,
      message: 'Historial obtenido exitosamente.',
      data: history,
    };
  }

  async dashboard(month?: number, year?: number, categoryId?: number) {
    const today = this.todayUtc();
    const safeMonth =
      month && month >= 1 && month <= 12 ? month : today.getUTCMonth() + 1;
    const safeYear = year || today.getUTCFullYear();
    const documents = await this.prisma.expiringDocument.findMany({
      where: {
        deletedAt: null,
        ...(categoryId ? { categoryId } : {}),
        expirationDate: {
          gte: new Date(Date.UTC(safeYear, safeMonth - 1, 1)),
          lt: new Date(Date.UTC(safeYear, safeMonth, 1)),
        },
      },
      include: documentInclude,
      orderBy: { expirationDate: 'asc' },
    });
    const items = documents.map((document) => this.mapDocument(document));
    const counts = items.reduce<
      Record<'expired' | 'upcoming' | 'valid', number>
    >(
      (result, item) => ({ ...result, [item.status]: result[item.status] + 1 }),
      { expired: 0, upcoming: 0, valid: 0 },
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Vencimientos obtenidos exitosamente.',
      data: { period: { month: safeMonth, year: safeYear }, counts, items },
    };
  }

  async sendDueAlerts() {
    const today = this.todayUtc();
    const documents = await this.prisma.expiringDocument.findMany({
      where: {
        deletedAt: null,
        expirationDate: { gte: today },
        category: {
          deletedAt: null,
          emailNotificationsEnabled: true,
          notificationEmails: { isEmpty: false },
        },
      },
      include: { category: true, notifications: true },
    });

    let sent = 0;
    for (const document of documents) {
      const daysRemaining = this.daysBetween(today, document.expirationDate);
      const levels = [
        {
          level: ExpiringDocumentAlertLevel.third,
          days: document.category.alertDaysThird,
        },
        {
          level: ExpiringDocumentAlertLevel.second,
          days: document.category.alertDaysSecond,
        },
        {
          level: ExpiringDocumentAlertLevel.first,
          days: document.category.alertDaysFirst,
        },
      ];
      const due = levels.find(
        ({ level, days }) =>
          daysRemaining <= days &&
          !document.notifications.some(
            (notification) =>
              notification.alertLevel === level &&
              notification.expirationDate.getTime() ===
                document.expirationDate.getTime(),
          ),
      );
      if (!due) continue;

      try {
        await this.mailService.sendDocumentExpiryAlert({
          recipients: document.category.notificationEmails,
          title: document.title,
          categoryName: document.category.name,
          expirationDate: document.expirationDate,
          daysRemaining,
          referenceDescription: document.referenceDescription,
          storageSpace: document.storageSpace,
          storagePath: document.storagePath,
          storageDescription: document.storageDescription,
        });
        await this.prisma.expiringDocumentNotification.create({
          data: {
            expiringDocumentId: document.expiringDocumentId,
            alertLevel: due.level,
            expirationDate: document.expirationDate,
            recipients: document.category.notificationEmails,
          },
        });
        sent += 1;
      } catch (error) {
        this.logger.error(
          `No se pudo enviar el aviso del documento ${document.expiringDocumentId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    this.logger.log(`Avisos documentales enviados: ${sent}`);
    return sent;
  }
}
