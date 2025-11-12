// attendance.service.ts
import { ConflictException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { WorkerType } from 'src/worker/enum/worker-type.enum';

type BreakdownItem = {
  workerId: number;
  fullName: string;
  workerType: string;
  days: number;
  dailyWage: number;
  total: number;
  discounts: number; // para "Dscts" del wireframe (0 si no manejas descuentos)
  net: number;       // total - discounts
};

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger('AttendanceService');

  constructor(private readonly prismaService: PrismaService) {}

  // ------------------------ CRUD existente ------------------------
  async create(createAttendanceDto: CreateAttendanceDto) {
    this.logger.log(`Creating attendance with data: ${JSON.stringify(createAttendanceDto)}`);

    this.logger.log(
      `Checking for existing attendance for workerId: ${createAttendanceDto.workerId} on date: ${createAttendanceDto.date}`,
    );
    const existingAttendance = await this.prismaService.attendance.findFirst({
      where: {
        workerId: createAttendanceDto.workerId,
        date: createAttendanceDto.date,
      },
    });

    if (existingAttendance) {
      this.logger.warn(
        `Attendance already exists for workerId: ${createAttendanceDto.workerId} on date: ${createAttendanceDto.date}`,
      );
      throw new ConflictException('Ya existe una asistencia para este trabajador en la fecha proporcionada.');
    }

    const week = await this.findWeekByDate(new Date(createAttendanceDto.date));

    if (!week) {
      this.logger.warn(`No week found for date: ${createAttendanceDto.date}`);
      throw new ConflictException('No se encontró una semana válida para la fecha proporcionada.');
    }

    const attendance = await this.prismaService.attendance.create({
      data: {
        ...createAttendanceDto,
        weekId: week.weekId,
      },
    });

    this.logger.log(`Attendance created successfully with ID: ${attendance.attendanceId}`);
    return {
      message: 'Asistencia creada exitosamente.',
      statusCode: HttpStatus.CREATED,
      data: attendance,
    };
  }

  async findAll(weekId?: number, projectId?: number, workerId?: number) {
    this.logger.log('Fetching all attendances (Prisma)');

    const attendances = await this.prismaService.attendance.findMany({
      where: {
        weekId,
        projectId,
        workerId,
      },
      orderBy: { attendanceId: 'desc' },
      include: {
        worker: true,
        project: true,
        week: true,
      },
    });

    if (!attendances.length) {
      this.logger.warn('No attendances found in the database');
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No se han encontrado asistencias para este proyecto.',
        data: [],
      };
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Asistencias recuperadas exitosamente.',
      data: attendances,
    };
  }

  async remove(id: number) {
    this.logger.log(`Deleting attendance with ID: ${id}`);

    const attendance = await this.prismaService.attendance.delete({
      where: { attendanceId: id },
    });

    if (!attendance) {
      this.logger.warn(`Attendance with ID: ${id} not found for deletion`);
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No se encontró la asistencia para eliminar.',
      };
    }

    this.logger.log(`Attendance with ID: ${id} deleted successfully`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Asistencia eliminada exitosamente.',
      data: attendance,
    };
  }

  // ------------------------ HELPERS PRIVADOS ------------------------
  /** Retorna el dailyWage vigente (último validFrom <= asOfDate) por worker, en lote */
  private async getCurrentDailyWages(workerIds: number[], asOfDate: Date) {
    const workers = await this.prismaService.worker.findMany({
      where: { workerId: { in: workerIds } },
      select: {
        workerId: true,
        fullName: true,
        workerType: true,
        dailyWages: {
          where: { validFrom: { lte: asOfDate } },
          orderBy: { validFrom: 'desc' },
          take: 1,
          select: { amount: true },
        },
      },
    });

    return workers.map((w) => ({
      workerId: w.workerId,
      fullName: w.fullName,
      workerType: w.workerType,
      dailyWage: w.dailyWages[0]?.amount ? Number(w.dailyWages[0].amount) : 0,
    }));
  }

  private computeTotals(breakdown: BreakdownItem[]) {
    const laborer = breakdown
      .filter((b) => b.workerType === WorkerType.Laborer)
      .reduce((acc, b) => acc + b.total, 0);

    const technician = breakdown
      .filter((b) => b.workerType === WorkerType.Technician)
      .reduce((acc, b) => acc + b.total, 0);

    const grandTotal = +(laborer + technician).toFixed(2);

    return {
      laborer: +laborer.toFixed(2),
      technician: +technician.toFixed(2),
      total: grandTotal,
    };
  }

  // ------------------------ PLANILLAS DENTRO DE UN PROYECTO ------------------------

  /**
   * (Detalle) Proyecto + Semana
   * Suma asistencias por worker en esa semana y proyecto,
   * multiplica por su dailyWage vigente y separa por workerType.
   */
  async getWeeklyPayrollForProjectWeek(params: {
    projectId: number;
    weekId: number;
    asOfDate?: Date;
  }) {
    const { projectId, weekId } = params;
    const asOf = params.asOfDate ?? new Date();

    // groupBy de asistencias
    const grouped = await this.prismaService.attendance.groupBy({
      by: ['workerId'],
      where: { projectId, weekId },
      _count: { _all: true },
    });

    if (grouped.length === 0) {
      return {
        projectId,
        weekId,
        totals: { laborer: 0, technician: 0, total: 0 },
        breakdown: [] as BreakdownItem[],
      };
    }

    const workerIds = grouped.map((g) => g.workerId);
    const wages = await this.getCurrentDailyWages(workerIds, asOf);

    const countByWorker = new Map<number, number>(grouped.map((g) => [g.workerId, g._count._all]));

    const breakdown: BreakdownItem[] = wages.map((w) => {
      const days = countByWorker.get(w.workerId) ?? 0;
      const total = +(days * w.dailyWage).toFixed(2);
      const discounts = 0;
      const net = +(total - discounts).toFixed(2);
      return {
        workerId: w.workerId,
        fullName: w.fullName,
        workerType: w.workerType,
        days,
        dailyWage: w.dailyWage,
        total,
        discounts,
        net,
      };
    });

    const totals = this.computeTotals(breakdown);
    return { projectId, weekId, totals, breakdown };
  }

  /**
   * (Resumen) Todas las semanas del proyecto con totales por tipo.
   * Útil para la tabla de "Manejo de planillas dentro de un proyecto".
   */
  async getWeeklyPayrollSummaryByProject(projectId: number, asOfDate: Date = new Date()) {
    const weeksWithAttendance = await this.prismaService.attendance.groupBy({
      by: ['weekId'],
      where: { projectId },
      _count: { _all: true },
    });

    if (weeksWithAttendance.length === 0) return [];

    const weeks = await this.prismaService.week.findMany({
      where: { weekId: { in: weeksWithAttendance.map((w) => w.weekId) } },
      select: { weekId: true, startDate: true, endDate: true },
      orderBy: { startDate: 'desc' },
    });

    const rows = await Promise.all(
      weeks.map(async (w) => {
        const detail = await this.getWeeklyPayrollForProjectWeek({
          projectId,
          weekId: w.weekId,
          asOfDate,
        });
        return {
          weekId: w.weekId,
          startDate: w.startDate,
          endDate: w.endDate,
          laborerTotal: detail.totals.laborer,
          technicianTotal: detail.totals.technician,
          grandTotal: detail.totals.total,
        };
      }),
    );

    return rows;
  }

  // ------------------------ PLANILLAS EN GENERAL (TODOS LOS PROYECTOS) ------------------------

  /**
   * (Detalle) Semana global (todas las asistencias de esa semana en todos los proyectos)
   */
  async getGlobalWeeklyPayrollForWeek(weekId: number, asOfDate: Date = new Date()) {
    const grouped = await this.prismaService.attendance.groupBy({
      by: ['workerId'],
      where: { weekId },
      _count: { _all: true },
    });

    if (grouped.length === 0) {
      return {
        weekId,
        totals: { laborer: 0, technician: 0, total: 0 },
        breakdown: [] as BreakdownItem[],
      };
    }

    const workerIds = grouped.map((g) => g.workerId);
    const wages = await this.getCurrentDailyWages(workerIds, asOfDate);
    const countByWorker = new Map<number, number>(grouped.map((g) => [g.workerId, g._count._all]));

    const breakdown: BreakdownItem[] = wages.map((w) => {
      const days = countByWorker.get(w.workerId) ?? 0;
      const total = +(days * w.dailyWage).toFixed(2);
      const discounts = 0;
      const net = +(total - discounts).toFixed(2);
      return {
        workerId: w.workerId,
        fullName: w.fullName,
        workerType: w.workerType,
        days,
        dailyWage: w.dailyWage,
        total,
        discounts,
        net,
      };
    });

    const totals = this.computeTotals(breakdown);
    return { weekId, totals, breakdown };
  }

  /**
   * (Resumen) Todas las semanas con asistencias a nivel global
   * Útil para la tabla de "Manejo de planillas en general".
   */
  async getGlobalWeeklyPayrollSummary(asOfDate: Date = new Date()) {
    const weeksWithAttendance = await this.prismaService.attendance.groupBy({
      by: ['weekId'],
      _count: { _all: true },
    });

    if (weeksWithAttendance.length === 0) return [];

    const weeks = await this.prismaService.week.findMany({
      where: { weekId: { in: weeksWithAttendance.map((w) => w.weekId) } },
      select: { weekId: true, startDate: true, endDate: true },
      orderBy: { startDate: 'desc' },
    });

    const rows = await Promise.all(
      weeks.map(async (w) => {
        const detail = await this.getGlobalWeeklyPayrollForWeek(w.weekId, asOfDate);
        return {
          weekId: w.weekId,
          startDate: w.startDate,
          endDate: w.endDate,
          laborerTotal: detail.totals.laborer,
          technicianTotal: detail.totals.technician,
          grandTotal: detail.totals.total,
        };
      }),
    );

    return rows;
  }

  async findWeekByDate(date: Date) {
    const week = await this.prismaService.week.findFirst({
      where: {
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });

    return week;
  }
}
