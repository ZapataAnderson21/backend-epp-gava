import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SaveWeeklyWagesDto } from './dto/save-weekly-wages.dto';

@Injectable()
export class WeeklyWageService {
  private readonly logger = new Logger('WeeklyWageService');

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * GET /weekly-wage/weeks
   * Obtener todas las semanas que tienen asistencias registradas
   */
  async findWeeksWithAttendances() {
    this.logger.log('Fetching weeks with attendances');

    // Obtener semanas que tienen al menos una asistencia
    const weeksWithAttendances = await this.prismaService.week.findMany({
      where: {
        attendances: {
          some: {},
        },
      },
      include: {
        attendances: {
          select: {
            workerId: true,
          },
        },
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    const data = weeksWithAttendances.map((week) => {
      const uniqueWorkers = new Set(week.attendances.map((a) => a.workerId));
      return {
        weekId: week.weekId,
        startDate: week.startDate,
        endDate: week.endDate,
        totalWorkers: uniqueWorkers.size,
        totalAttendances: week.attendances.length,
      };
    });

    return {
      message: 'Semanas con asistencias obtenidas correctamente.',
      statusCode: HttpStatus.OK,
      data,
    };
  }

  /**
   * GET /weekly-wage/week/:weekId
   * Obtener detalle de una semana específica con trabajadores y cálculos
   */
  async findWeekDetail(weekId: number) {
    this.logger.log(`Fetching week detail for weekId=${weekId}`);

    // Obtener la semana
    const week = await this.prismaService.week.findUnique({
      where: { weekId },
    });

    if (!week) {
      throw new HttpException('Semana no encontrada.', HttpStatus.NOT_FOUND);
    }

    // Obtener asistencias de la semana agrupadas por trabajador
    const attendances = await this.prismaService.attendance.findMany({
      where: { weekId },
      include: {
        worker: {
          select: {
            workerId: true,
            fullName: true,
            workerType: true,
            dailyWages: {
              where: {
                validFromDate: {
                  lte: week.startDate,
                },
              },
              orderBy: {
                validFromDate: 'desc',
              },
              take: 1,
            },
          },
        },
      },
    });

    // Obtener WeeklyWages existentes para esta semana
    const existingWeeklyWages = await this.prismaService.weeklyWage.findMany({
      where: { weekId },
    });

    const weeklyWageMap = new Map(
      existingWeeklyWages.map((ww) => [ww.workerId, ww]),
    );

    // Agrupar asistencias por trabajador
    const workerAttendanceMap = new Map<
      number,
      {
        worker: {
          workerId: number;
          fullName: string;
          workerType: string;
          dailyWages: { amount: unknown }[];
        };
        count: number;
      }
    >();

    for (const attendance of attendances) {
      const existing = workerAttendanceMap.get(attendance.workerId);
      if (existing) {
        existing.count++;
      } else {
        workerAttendanceMap.set(attendance.workerId, {
          worker: attendance.worker,
          count: 1,
        });
      }
    }

    // Construir lista de trabajadores con cálculos
    const workers = Array.from(workerAttendanceMap.values()).map(
      ({ worker, count }) => {
        const dailyWageAmount =
          worker.dailyWages.length > 0
            ? Number(worker.dailyWages[0].amount)
            : 0;

        const grossAmount = count * dailyWageAmount;

        return {
          workerId: worker.workerId,
          workerName: worker.fullName,
          workerType: worker.workerType,
          attendances: count,
          dailyWage: dailyWageAmount,
          grossAmount,
          weeklyWage: grossAmount,
        };
      },
    );

    // Calcular resumen
    const summary = workers.reduce(
      (acc, w) => ({
        totalGross: acc.totalGross + w.grossAmount,
        totalNet: acc.totalNet + w.weeklyWage,
      }),
      { totalGross: 0, totalNet: 0 },
    );

    return {
      message: 'Detalle de semana obtenido correctamente.',
      statusCode: HttpStatus.OK,
      data: {
        weekId: week.weekId,
        startDate: week.startDate,
        endDate: week.endDate,
        workers,
        summary,
      },
    };
  }

  /**
   * POST /weekly-wage/week/:weekId/save
   * Guardar/actualizar pagos semanales
   */
  async saveWeeklyWages(weekId: number, dto: SaveWeeklyWagesDto) {
    this.logger.log(
      `Saving weekly wages for weekId=${weekId}, items=${dto.items.length}`,
    );

    // Verificar que la semana existe
    const week = await this.prismaService.week.findUnique({
      where: { weekId },
    });

    if (!week) {
      throw new HttpException('Semana no encontrada.', HttpStatus.NOT_FOUND);
    }

    // Obtener asistencias de la semana
    const attendances = await this.prismaService.attendance.findMany({
      where: { weekId },
      include: {
        worker: {
          select: {
            workerId: true,
            dailyWages: {
              where: {
                validFromDate: {
                  lte: week.startDate,
                },
              },
              orderBy: {
                validFromDate: 'desc',
              },
              take: 1,
            },
          },
        },
      },
    });

    // Contar asistencias por trabajador
    const attendanceCountMap = new Map<number, number>();
    const dailyWageMap = new Map<number, number>();

    for (const attendance of attendances) {
      const current = attendanceCountMap.get(attendance.workerId) || 0;
      attendanceCountMap.set(attendance.workerId, current + 1);

      if (!dailyWageMap.has(attendance.workerId)) {
        const dailyWage =
          attendance.worker.dailyWages.length > 0
            ? Number(attendance.worker.dailyWages[0].amount)
            : 0;
        dailyWageMap.set(attendance.workerId, dailyWage);
      }
    }

    // Crear transacciones de upsert
    const operations = dto.items.map((item) => {
      const attendanceCount = attendanceCountMap.get(item.workerId) || 0;
      const dailyWage = dailyWageMap.get(item.workerId) || 0;
      const grossAmount = attendanceCount * dailyWage;

      return this.prismaService.weeklyWage.upsert({
        where: {
          workerId_weekId: {
            workerId: item.workerId,
            weekId: weekId,
          },
        },
        create: {
          workerId: item.workerId,
          weekId: weekId,
          grossAmount: grossAmount,
          totalAmount: grossAmount,
        },
        update: {
          grossAmount: grossAmount,
          totalAmount: grossAmount,
        },
      });
    });

    const result = await this.prismaService.$transaction(operations);

    return {
      message: 'Pagos semanales guardados correctamente.',
      statusCode: HttpStatus.OK,
      data: result,
    };
  }
}
