import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ReplaceElementRequestWorkerPlansDto } from './dto/replace-element_request_worker_plans.dto';

@Injectable()
export class ElementRequestWorkerPlanService {
  constructor(private readonly prismaService: PrismaService) {}

  private normalizeQuantity(value: unknown) {
    const numberValue = Number(value ?? 0);
    return Math.round(numberValue * 10000) / 10000;
  }

  private supportsWorkerPlanning(element: {
    family?: string | null;
    type: string;
    controlType: string;
  }) {
    if (element.family) {
      return element.family === 'uniform';
    }

    return element.type === 'epp' && element.controlType === 'individual';
  }

  private async findDraftElementRequest(
    elementRequestId: number,
    actorUserId: number,
  ) {
    const elementRequest = await this.prismaService.elementRequest.findUnique({
      where: { elementRequestId },
      include: {
        request: true,
        element: true,
      },
    });

    if (!elementRequest) {
      throw new NotFoundException('No se encontro la linea del requerimiento.');
    }

    if (elementRequest.request.userId !== actorUserId) {
      throw new NotFoundException('No se encontro la linea del requerimiento.');
    }

    if (elementRequest.request.status !== 'draft') {
      throw new BadRequestException(
        'Solo puedes editar la planificación por trabajador mientras el requerimiento esté en borrador.',
      );
    }

    if (!this.supportsWorkerPlanning(elementRequest.element)) {
      throw new BadRequestException(
        'La planificación por trabajador solo aplica a Ropa de Trabajo.',
      );
    }

    return elementRequest;
  }

  async findAllByElementRequestId(
    elementRequestId: number,
    actorUserId: number,
  ) {
    await this.findDraftElementRequest(elementRequestId, actorUserId);

    const plans = await this.prismaService.elementRequestWorkerPlan.findMany({
      where: { elementRequestId },
      include: {
        requestWorker: {
          include: {
            worker: true,
          },
        },
      },
      orderBy: { elementRequestWorkerPlanId: 'asc' },
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Planificación por trabajador obtenida exitosamente.',
      data: plans,
    };
  }

  async replaceForElementRequest(
    elementRequestId: number,
    replaceDto: ReplaceElementRequestWorkerPlansDto,
    actorUserId: number,
  ) {
    const elementRequest = await this.findDraftElementRequest(
      elementRequestId,
      actorUserId,
    );
    const normalizedPlans = (replaceDto.plans || [])
      .map((plan) => ({
        requestWorkerId: plan.requestWorkerId,
        plannedQuantity: this.normalizeQuantity(plan.plannedQuantity),
        size: plan.size?.trim() || null,
        notes: plan.notes?.trim() || null,
      }))
      .filter((plan) => plan.plannedQuantity > 0);

    const plannedTotal = normalizedPlans.reduce(
      (total, plan) => total + plan.plannedQuantity,
      0,
    );
    if (plannedTotal > Number(elementRequest.quantityRequested)) {
      throw new BadRequestException(
        'La cantidad planificada para trabajadores no puede superar la cantidad solicitada.',
      );
    }

    const requestWorkerIds = normalizedPlans.map(
      (plan) => plan.requestWorkerId,
    );
    const uniqueRequestWorkerIds = [...new Set(requestWorkerIds)];

    const requestWorkers = uniqueRequestWorkerIds.length
      ? await this.prismaService.requestWorker.findMany({
          where: {
            requestWorkerId: { in: uniqueRequestWorkerIds },
            requestId: elementRequest.requestId,
          },
        })
      : [];

    if (requestWorkers.length !== uniqueRequestWorkerIds.length) {
      throw new BadRequestException(
        'Todos los trabajadores planificados deben pertenecer al mismo requerimiento.',
      );
    }

    if (uniqueRequestWorkerIds.length !== requestWorkerIds.length) {
      throw new BadRequestException(
        'No se puede repetir el mismo trabajador en la planificación de una misma prenda y talla.',
      );
    }

    const plans = await this.prismaService.$transaction(async (tx) => {
      await tx.elementRequestWorkerPlan.deleteMany({
        where: { elementRequestId },
      });

      if (normalizedPlans.length > 0) {
        await tx.elementRequestWorkerPlan.createMany({
          data: normalizedPlans.map((plan) => ({
            elementRequestId,
            requestWorkerId: plan.requestWorkerId,
            plannedQuantity: plan.plannedQuantity,
            size: plan.size,
            notes: plan.notes,
          })),
        });
      }

      return tx.elementRequestWorkerPlan.findMany({
        where: { elementRequestId },
        include: {
          requestWorker: {
            include: {
              worker: true,
            },
          },
        },
        orderBy: { elementRequestWorkerPlanId: 'asc' },
      });
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Planificación por trabajador actualizada exitosamente.',
      data: plans,
    };
  }
}
