import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from 'src/generated/prisma';
import { SaveRequestFormDraftDto } from './dto/request-form-draft.dto';

@Injectable()
export class RequestFormDraftService {
  constructor(private readonly prisma: PrismaService) {}
  private async checkProject(projectId: unknown) {
    if (
      !Number.isInteger(projectId) ||
      Number(projectId) < 1 ||
      Number(projectId) > 2147483647
    )
      throw new BadRequestException('Proyecto inválido.');
    const project = await this.prisma.project.findFirst({
      where: { projectId: Number(projectId), deletedAt: null },
      select: { projectId: true },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado.');
  }
  private async checkScope(userId: number, slot: string, writing = false) {
    if (slot.startsWith('project-'))
      return this.checkProject(Number(slot.slice(8)));
    if (slot === 'new') return;
    const requestId = Number(slot);
    if (!Number.isInteger(requestId) || requestId < 1 || requestId > 2147483647)
      throw new BadRequestException('Requerimiento inválido.');
    const request = await this.prisma.request.findFirst({
      where: { requestId, userId },
      select: { status: true },
    });
    if (!request) throw new NotFoundException('Requerimiento no encontrado.');
    if (writing && request.status !== 'draft')
      throw new ConflictException(
        'El requerimiento ya fue enviado y no puede editarse.',
      );
  }
  async read(userId: number, slot: string) {
    await this.checkScope(userId, slot);
    return (
      (await this.prisma.requestFormDraft.findUnique({
        where: { userId_slot: { userId, slot } },
        select: { payload: true, version: true, updatedAt: true },
      })) ?? { payload: null, version: 0, updatedAt: null }
    );
  }
  async save(userId: number, slot: string, dto: SaveRequestFormDraftDto) {
    await this.checkScope(userId, slot, dto.payload !== null);
    if (Buffer.byteLength(JSON.stringify(dto.payload), 'utf8') > 65536)
      throw new BadRequestException(
        'El borrador supera el tamaño máximo de 64 KB.',
      );
    if (dto.payload) {
      if (
        dto.payload.schemaVersion !== 1 ||
        !Number.isInteger(dto.payload.projectId) ||
        Number(dto.payload.projectId) < 0
      )
        throw new BadRequestException('Borrador inválido.');
      // Only explicit form fields may be stored; SMTP credentials never belong here.
      const allowed = new Set([
        'schemaVersion',
        'createdRequestId',
        'projectId',
        'deliveryDueDate',
        'description',
        'activeFamily',
        'elementRequests',
        'requestWorkers',
        'elementPlans',
        'pendingPlanning',
      ]);
      if (Object.keys(dto.payload).some((key) => !allowed.has(key)))
        throw new BadRequestException(
          'El borrador contiene campos no permitidos.',
        );
      if (dto.payload.projectId !== 0)
        await this.checkProject(dto.payload.projectId);
      if (
        slot.startsWith('project-') &&
        dto.payload.projectId !== Number(slot.slice(8))
      )
        throw new BadRequestException(
          'El proyecto no coincide con el formulario.',
        );
    }
    const scope = { userId, slot };
    const payload =
      dto.payload === null
        ? Prisma.DbNull
        : (dto.payload as Prisma.InputJsonObject);
    return this.prisma.$transaction(async (tx) => {
      const result =
        dto.expectedVersion === 0
          ? await tx.requestFormDraft.createMany({
              data: { ...scope, payload },
              skipDuplicates: true,
            })
          : await tx.requestFormDraft.updateMany({
              where: { ...scope, version: dto.expectedVersion },
              data: { payload, version: { increment: 1 } },
            });
      const current = await tx.requestFormDraft.findUnique({
        where: { userId_slot: scope },
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
