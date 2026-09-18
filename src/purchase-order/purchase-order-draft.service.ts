import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from 'src/generated/prisma';
import { SavePurchaseOrderDraftDto } from './dto/purchase-order-draft.dto';

@Injectable()
export class PurchaseOrderDraftService {
  constructor(private readonly prisma: PrismaService) {}

  private async checkScope(projectId: number, slot: string) {
    if (
      !Number.isSafeInteger(projectId) ||
      projectId < 1 ||
      projectId > 2147483647
    )
      throw new BadRequestException('Proyecto inválido.');
    const project = await this.prisma.project.findFirst({
      where: { projectId, deletedAt: null },
      select: { projectId: true },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado.');
    if (slot !== 'new') {
      const purchaseOrderId = Number(slot);
      if (purchaseOrderId > 2147483647)
        throw new BadRequestException('Orden inválida.');
      const order = await this.prisma.purchaseOrder.findFirst({
        where: { purchaseOrderId, projectId },
        select: { purchaseOrderId: true },
      });
      if (!order)
        throw new NotFoundException('Orden no encontrada en este proyecto.');
    }
  }

  async read(userId: number, projectId: number, slot: string) {
    await this.checkScope(projectId, slot);
    return (
      (await this.prisma.purchaseOrderDraft.findUnique({
        where: { userId_projectId_slot: { userId, projectId, slot } },
        select: { payload: true, version: true, updatedAt: true },
      })) ?? { payload: null, version: 0, updatedAt: null }
    );
  }

  async save(
    userId: number,
    projectId: number,
    slot: string,
    dto: SavePurchaseOrderDraftDto,
  ) {
    await this.checkScope(projectId, slot);
    if (Buffer.byteLength(JSON.stringify(dto.payload), 'utf8') > 65536)
      throw new BadRequestException(
        'El borrador supera el tamaño máximo de 64 KB.',
      );
    const scope = { userId, projectId, slot };
    const payload =
      dto.payload === null
        ? Prisma.DbNull
        : (dto.payload as Prisma.InputJsonObject);
    return this.prisma.$transaction(async (tx) => {
      // Conditional writes, including first creation, serialize competing devices.
      const result =
        dto.expectedVersion === 0
          ? await tx.purchaseOrderDraft.createMany({
              data: { ...scope, payload },
              skipDuplicates: true,
            })
          : await tx.purchaseOrderDraft.updateMany({
              where: { ...scope, version: dto.expectedVersion },
              data: { payload, version: { increment: 1 } },
            });
      const current = await tx.purchaseOrderDraft.findUnique({
        where: { userId_projectId_slot: scope },
        select: { payload: true, version: true, updatedAt: true },
      });
      if (result.count !== 1)
        throw new ConflictException({
          message: 'El borrador cambió en otra sesión.',
          current,
        });
      return current;
    });
  }
}
