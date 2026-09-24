import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from 'src/generated/prisma';
import { buildRenumberPlan, numberingFingerprint } from './renumber-plan';
import { PreviewRenumberDto } from './renumber.dto';

@Injectable()
export class RenumberService {
  constructor(private readonly prisma: PrismaService) {}
  private validateYear(year: number) {
    if (!Number.isInteger(year) || year < 2000 || year > 9999)
      throw new BadRequestException('Año inválido.');
  }
  private rows(db: Prisma.TransactionClient, year: number) {
    this.validateYear(year);
    // All projects, including deleted projects, participate in annual numbering.
    return db.purchaseOrder.findMany({
      where: { code: { contains: `-${year}/` } },
      select: {
        purchaseOrderId: true,
        code: true,
        updatedAt: true,
        status: true,
        project: { select: { name: true } },
        supplier: { select: { name: true } },
      },
      orderBy: { purchaseOrderId: 'asc' },
    });
  }
  async candidates(year: number) {
    return { data: await this.rows(this.prisma, year) };
  }
  async preview(dto: PreviewRenumberDto, userId: number) {
    const rows = await this.rows(this.prisma, dto.year);
    const plan = buildRenumberPlan(rows, dto.ids, dto.year, dto.start);
    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: { name: true, lastName: true },
    });
    const operation = await this.prisma.purchaseOrderRenumber.create({
      data: {
        id: randomUUID(),
        userId,
        actorName: user ? `${user.name} ${user.lastName}` : String(userId),
        year: dto.year,
        plan: plan as unknown as Prisma.InputJsonValue,
        fingerprint: numberingFingerprint(rows),
      },
    });
    return {
      data: {
        id: operation.id,
        year: dto.year,
        ...plan,
        createdAt: operation.createdAt,
      },
    };
  }
  async apply(id: string, rawReason: string, userId: number) {
    const reason = rawReason.trim();
    if (reason.length < 3 || reason.length > 500)
      throw new BadRequestException('Escribe un motivo de 3 a 500 caracteres.');
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(20260921, 1)`;
        // Also serialize edits/deletes, which do not acquire the creation lock.
        await tx.$executeRawUnsafe(
          'LOCK TABLE "PurchaseOrder" IN SHARE ROW EXCLUSIVE MODE',
        );
        const operation = await tx.purchaseOrderRenumber.findUnique({
          where: { id },
        });
        if (!operation || operation.userId !== userId)
          throw new NotFoundException('Vista previa no encontrada.');
        const plan = operation.plan as unknown as ReturnType<
          typeof buildRenumberPlan
        >;
        if (operation.appliedAt) {
          if (operation.reason !== reason)
            throw new ConflictException(
              'Este intento ya se aplicó con otro motivo.',
            );
          return {
            data: { id, ...plan, appliedAt: operation.appliedAt },
            message: 'La corrección ya estaba aplicada.',
          };
        }
        if (Date.now() - operation.createdAt.getTime() > 30 * 60 * 1000)
          throw new ConflictException(
            'La vista previa venció. Genera una nueva.',
          );
        const rows = await this.rows(tx, operation.year);
        if (numberingFingerprint(rows) !== operation.fingerprint)
          throw new ConflictException(
            'Las OC cambiaron desde la vista previa. Revísala nuevamente.',
          );
        // Temporary unique codes allow overlapping shifts under the unique code constraint.
        for (const change of plan.changes)
          await tx.purchaseOrder.update({
            where: { purchaseOrderId: change.purchaseOrderId },
            data: { code: `RENUMBER-${id}-${change.purchaseOrderId}` },
          });
        for (const change of plan.changes)
          await tx.purchaseOrder.update({
            where: { purchaseOrderId: change.purchaseOrderId },
            data: { code: change.after },
          });
        const appliedAt = new Date();
        await tx.purchaseOrderRenumber.update({
          where: { id },
          data: { reason, appliedAt },
        });
        return {
          data: { id, ...plan, appliedAt },
          message: 'Numeración corregida. Vuelve a generar los PDF afectados.',
        };
      },
      { maxWait: 15000, timeout: 30000 },
    );
  }
  async history(year: number, page: number) {
    this.validateYear(year);
    if (!Number.isSafeInteger(page) || page < 1)
      throw new BadRequestException('Página inválida.');
    const where = { year, appliedAt: { not: null } };
    const [items, total] = await Promise.all([
      this.prisma.purchaseOrderRenumber.findMany({
        where,
        orderBy: [{ appliedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * 20,
        take: 20,
        select: {
          id: true,
          userId: true,
          actorName: true,
          year: true,
          reason: true,
          appliedAt: true,
          plan: true,
        },
      }),
      this.prisma.purchaseOrderRenumber.count({ where }),
    ]);
    return { data: { items, total, page } };
  }
}
