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

  constructor(private readonly prismaService: PrismaService) {}
  
  // Obtiene el lunes de la semana en UTC (para evitar problemas de zona horaria)
  private getMonday(date: Date): Date {
    const d = new Date(Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      0, 0, 0, 0
    ));
    const day = d.getUTCDay(); // 0 = domingo, 1 = lunes, ...
    const diff = (day + 6) % 7; // días desde lunes
    d.setUTCDate(d.getUTCDate() - diff);
    return d;
  }

  // Crea una semana a partir de un lunes (lunes 00:00:00 - domingo 23:59:59)
  private async createWeekFromMonday(monday: Date) {
    // startDate: lunes a las 00:00:00.000 UTC
    const startDate = new Date(Date.UTC(
      monday.getUTCFullYear(),
      monday.getUTCMonth(),
      monday.getUTCDate(),
      0, 0, 0, 0
    ));
    
    // endDate: domingo (6 días después) a las 23:59:59.999 UTC
    const endDate = new Date(Date.UTC(
      monday.getUTCFullYear(),
      monday.getUTCMonth(),
      monday.getUTCDate() + 6,
      23, 59, 59, 999
    ));

    this.logger.log(
      `Creando semana: ${startDate.toISOString()} - ${endDate.toISOString()}`
    );

    return this.prismaService.week.create({
      data: {
        startDate,
        endDate,
      },
    });
  }

  /**
   * Se asegura de que existan todas las semanas desde la primera
   * registrada hasta la semana actual, llenando todos los huecos.
   * Si el sistema estuvo caído y se saltaron semanas, las creará todas.
   */
  async ensureWeeksUpToCurrentWeek() {
    // Lunes de la semana actual (hoy)
    const today = new Date();
    const currentMonday = this.getMonday(today);

    // Obtener la primera y última semana en la BD
    const firstWeek = await this.prismaService.week.findFirst({
      orderBy: { startDate: 'asc' },
    });

    const lastWeek = await this.prismaService.week.findFirst({
      orderBy: { startDate: 'desc' },
    });

    let startMonday: Date;

    if (!firstWeek) {
      // Caso inicial: no hay semanas en la BD
      // Empezar desde la semana actual
      startMonday = new Date(currentMonday);
    } else {
      // Empezar desde la primera semana registrada
      startMonday = new Date(firstWeek.startDate);
    }

    // Obtener todas las semanas existentes
    const existingWeeks = await this.prismaService.week.findMany({
      select: { startDate: true },
      orderBy: { startDate: 'asc' },
    });

    const existingWeeksSet = new Set(
      existingWeeks.map(w => w.startDate.toISOString().split('T')[0])
    );

    // Iterar desde la primera semana hasta la semana actual
    let currentIterationMonday = new Date(startMonday);
    let createdCount = 0;

    while (currentIterationMonday <= currentMonday) {
      const mondayKey = currentIterationMonday.toISOString().split('T')[0];
      
      // Solo crear si no existe
      if (!existingWeeksSet.has(mondayKey)) {
        await this.createWeekFromMonday(new Date(currentIterationMonday));
        createdCount++;
      }
      
      // Avanzar a la siguiente semana
      currentIterationMonday.setDate(currentIterationMonday.getDate() + 7);
    }

    if (createdCount > 0) {
      this.logger.log(`Se crearon ${createdCount} semana(s) faltante(s)`);
    } else {
      this.logger.log('Todas las semanas están actualizadas');
    }
  }

  async getWeeklyPayrollByProject(projectId: number): Promise<{
      message: string;
      statusCode: number;
      data: WeeklyProjectPayroll[];
    }> {

    this.logger.log(`Calculating weekly payroll for project ID: ${projectId}`);

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
        { 
          workerType: String; 
          attendanceCount: number 
        }
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
          existing.workerType = worker.workerType;
        } else {
          workersMap.set(worker.workerId, {
            workerType: worker.workerType,
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
