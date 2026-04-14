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

  private isEpiElement(element: {
    family?: string | null;
    type: string;
    controlType: string;
  }) {
    if (element.family) {
      return element.family === 'epi';
    }

    return element.type === 'epp' && element.controlType === 'individual';
  }

  private async findDraftElementRequest(elementRequestId: number) {
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

    if (elementRequest.request.status !== 'draft') {
      throw new BadRequestException(
        'Solo puedes editar la planificacion EPI mientras el requerimiento este en borrador.',
      );
    }

    if (!this.isEpiElement(elementRequest.element)) {
      throw new BadRequestException(
        'La planificacion por trabajador solo aplica a lineas EPI.',
      );
    }

    return elementRequest;
  }

  async findAllByElementRequestId(elementRequestId: number) {
    await this.findDraftElementRequest(elementRequestId);

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
      message: 'Planificacion EPI obtenida exitosamente.',
      data: plans,
    };
  }

  async replaceForElementRequest(
    elementRequestId: number,
    replaceDto: ReplaceElementRequestWorkerPlansDto,
  ) {
    const elementRequest = await this.findDraftElementRequest(elementRequestId);
    const normalizedPlans = (replaceDto.plans || [])
      .map((plan) => ({
        requestWorkerId: plan.requestWorkerId,
        plannedQuantity: this.normalizeQuantity(plan.plannedQuantity),
        size: plan.size?.trim() || null,
        notes: plan.notes?.trim() || null,
      }))
      .filter((plan) => plan.plannedQuantity > 0);

    const requestWorkerIds = normalizedPlans.map((plan) => plan.requestWorkerId);
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
        'No se puede repetir el mismo trabajador en la planificacion de una misma linea EPI.',
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
      message: 'Planificacion EPI actualizada exitosamente.',
      data: plans,
    };
  }
}
