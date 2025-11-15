import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { WorkerType, WorkerTypeLabelEs } from 'src/worker/enum/worker-type.enum';

interface WeeklyWorkerInfo {
  workerId: number;
  workerName: string;
  workerType: string;
  attendances: number;
  dailyWage: number;
}

export interface WeeklyProjectPayroll {
  weekId: number;
  startDate: Date;
  endDate: Date;
  laborerAmount: number;
  technicianAmount: number;
  totalAmount: number;
  workers: WeeklyWorkerInfo[];
}

@Injectable()
export class WeekService {
  private readonly logger = new Logger("WeekService");

  constructor(private readonly prismaService: PrismaService) {}s

  async createWeekForToday() {
    const startDate = new Date();      // el cron se ejecuta lunes 00:00
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6); // hasta domingo
    endDate.setHours(23, 59, 59, 999);

    return this.prismaService.week.create({
      data: {
        startDate,
        endDate,
      },
    });
  }

  async getWeeklyPayrollByProject(projectId: number): Promise<{
      message: string;
      statusCode: number;
      data: WeeklyProjectPayroll[];
    }> {
    // 1. Semanas que tienen asistencias de ese proyecto
    const weeks = await this.prismaService.week.findMany({
      where: {
        attendances: {
          some: { projectId },
        },
      },
      include: {
        attendances: {
          where: { projectId },
          include: {
            worker: true, // para workerType
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    const data: WeeklyProjectPayroll[] = [];

    for (const week of weeks) {
      let laborerAmount = 0;
      let technicianAmount = 0;

      // 2. Agrupar asistencias por workerId dentro de la semana
      const workersMap = new Map<
        number,
        { workerType: WorkerType; attendanceCount: number }
      >();

      for (const attendance of week.attendances) {
        const { worker } = attendance;

        // solo laborer y technician
        if (worker.workerType !== 'laborer' && worker.workerType !== 'technician') {
          continue;
        }

        const existing = workersMap.get(worker.workerId);
        if (existing) {
          existing.attendanceCount += 1;
        } else {
          workersMap.set(worker.workerId, {
            workerType: WorkerType[worker.workerType],
            attendanceCount: 1,
          });
        }
      }

      const workers: WeeklyWorkerInfo[] = [];

      // 3. Calcular montos por worker y acumular totales por tipo
      for (const [workerId, info] of workersMap.entries()) {
        const dailyWage = await this.prismaService.dailyWage.findFirst({
          where: {
            workerId,
            validFromWeekId: {
              lte: week.weekId,   // vigente hasta esta semana
            },
          },
          orderBy: {
            validFromWeekId: 'desc',
          },
        });

        const dailyAmount = dailyWage?.amount ?? 0;
        const workerTotal = Number(dailyAmount) * info.attendanceCount;

        if (info.workerType === 'laborer') {
          laborerAmount = laborerAmount + workerTotal;
        } else if (info.workerType === 'technician') {
          technicianAmount = technicianAmount + workerTotal;
        }

        workers.push({
          workerId,
          workerName: (await this.prismaService.worker.findUnique({ where: { workerId } }))?.fullName || 'Unknown',
          workerType: (await this.prismaService.worker.findUnique({ where: { workerId } }))?.workerType as WorkerType,
          attendances: info.attendanceCount,
          dailyWage: Number(dailyAmount),
        });
      }

      const totalAmount = laborerAmount + technicianAmount;

      data.push({
        weekId: week.weekId,
        startDate: week.startDate,
        endDate: week.endDate,
        laborerAmount: Number(laborerAmount),
        technicianAmount: Number(technicianAmount),
        totalAmount: Number(totalAmount),
        workers,
      });
    }

    return {
      message: 'Weekly payroll calculated successfully',
      statusCode: HttpStatus.OK,
      data,
    };
  }
}
