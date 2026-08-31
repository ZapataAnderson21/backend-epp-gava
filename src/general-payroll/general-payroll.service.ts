import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from 'src/generated/prisma';
import { ConfigureGeneralPayrollDto } from './dto/configure-general-payroll.dto';
import { InitializeGeneralPayrollDto } from './dto/initialize-general-payroll.dto';
import {
  SaveGeneralPayrollDto,
  SaveGeneralPayrollEntryDto,
} from './dto/save-general-payroll.dto';

const attendanceFields = [
  ['monday', 'lunes'],
  ['tuesday', 'martes'],
  ['wednesday', 'miércoles'],
  ['thursday', 'jueves'],
  ['friday', 'viernes'],
  ['saturday', 'sábado'],
  ['dominical', 'dominical'],
] as const;

const payrollInclude = {
  week: true,
  projects: {
    include: { project: true, entries: true },
    orderBy: { displayOrder: 'asc' as const },
  },
  workers: {
    include: { worker: true },
    orderBy: [
      { group: 'asc' as const },
      { displayOrder: 'asc' as const },
      { generalPayrollWorkerId: 'asc' as const },
    ],
  },
};

type PayrollWithRelations = Prisma.GeneralPayrollGetPayload<{
  include: typeof payrollInclude;
}>;
type PayrollEntry = Prisma.GeneralPayrollEntryGetPayload<object>;

@Injectable()
export class GeneralPayrollService {
  constructor(private readonly prisma: PrismaService) {}

  async findByProject(projectId: number) {
    const project = await this.prisma.project.findFirst({
      where: { projectId, deletedAt: null },
      select: { projectId: true, name: true, code: true },
    });
    if (!project)
      throw new NotFoundException('El proyecto indicado no existe.');

    const payrollProjects = await this.prisma.generalPayrollProject.findMany({
      where: { projectId },
      include: {
        generalPayroll: { include: { week: true } },
        entries: {
          include: {
            payrollWorker: { include: { worker: true } },
          },
        },
      },
    });

    const weeks = payrollProjects
      .map((payrollProject) => {
        const workers = payrollProject.entries
          .map((entry) => {
            const payrollWorker = entry.payrollWorker;
            const attendance = {
              monday: Number(entry.monday) > 0,
              tuesday: Number(entry.tuesday) > 0,
              wednesday: Number(entry.wednesday) > 0,
              thursday: Number(entry.thursday) > 0,
              friday: Number(entry.friday) > 0,
              saturday: Number(entry.saturday) > 0,
              dominical: Number(entry.dominical) > 0,
            };
            const attendanceCount =
              Object.values(attendance).filter(Boolean).length;
            const dailyWage = Number(payrollWorker.dailyWage);
            const overtimeAmount = Number(entry.overtimeAmount);
            const afpDiscount = Number(entry.afpDiscount);
            const advanceDiscount = Number(entry.advanceDiscount);
            const grossAmount = attendanceCount * dailyWage + overtimeAmount;
            const paidAmount = grossAmount - afpDiscount - advanceDiscount;

            return {
              generalPayrollEntryId: entry.generalPayrollEntryId,
              workerId: payrollWorker.workerId,
              fullName: payrollWorker.worker.fullName,
              dni: payrollWorker.worker.dni,
              group: payrollWorker.group,
              attendance,
              attendanceCount,
              dailyWage: this.round(dailyWage),
              overtimeAmount: this.round(overtimeAmount),
              grossAmount: this.round(grossAmount),
              afpDiscount: this.round(afpDiscount),
              advanceDiscount: this.round(advanceDiscount),
              paidAmount: this.round(paidAmount),
            };
          })
          .filter(
            (worker) =>
              worker.attendanceCount > 0 ||
              worker.overtimeAmount !== 0 ||
              worker.afpDiscount !== 0 ||
              worker.advanceDiscount !== 0,
          );

        const laborerAmount = workers
          .filter((worker) => worker.group === 'laborer')
          .reduce((total, worker) => total + worker.paidAmount, 0);
        const technicianAmount = workers
          .filter((worker) => worker.group === 'technician')
          .reduce((total, worker) => total + worker.paidAmount, 0);

        return {
          weekId: payrollProject.generalPayroll.weekId,
          startDate: payrollProject.generalPayroll.week.startDate,
          endDate: payrollProject.generalPayroll.week.endDate,
          laborerAmount: this.round(laborerAmount),
          technicianAmount: this.round(technicianAmount),
          totalAmount: this.round(laborerAmount + technicianAmount),
          workers,
        };
      })
      .filter((week) => week.workers.length > 0)
      .sort(
        (a, b) =>
          new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
      );

    const laborerAmount = weeks.reduce(
      (total, week) => total + week.laborerAmount,
      0,
    );
    const technicianAmount = weeks.reduce(
      (total, week) => total + week.technicianAmount,
      0,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Planillas del proyecto obtenidas correctamente.',
      data: {
        project,
        weekCount: weeks.length,
        laborerAmount: this.round(laborerAmount),
        technicianAmount: this.round(technicianAmount),
        totalAmount: this.round(laborerAmount + technicianAmount),
        weeks,
      },
    };
  }

  async findProjectTotals(projectId: number) {
    const response = await this.findByProject(projectId);
    const { laborerAmount, technicianAmount, totalAmount } = response.data;
    return {
      statusCode: HttpStatus.OK,
      message: 'Totales de planilla del proyecto obtenidos correctamente.',
      data: { laborerAmount, technicianAmount, totalAmount },
    };
  }

  async findWeeks() {
    const weeks = await this.prisma.week.findMany({
      orderBy: { startDate: 'desc' },
      include: {
        generalPayroll: {
          include: {
            workers: true,
            projects: { include: { entries: true } },
          },
        },
      },
    });

    const data = weeks.map((week) => {
      const payroll = week.generalPayroll;
      const projectTotal =
        payroll?.projects.reduce(
          (total, project) =>
            total +
            project.entries.reduce((subtotal, entry) => {
              const worker = payroll.workers.find(
                (item) =>
                  item.generalPayrollWorkerId === entry.generalPayrollWorkerId,
              );
              if (!worker) return subtotal;
              const days =
                Number(entry.monday) +
                Number(entry.tuesday) +
                Number(entry.wednesday) +
                Number(entry.thursday) +
                Number(entry.friday) +
                Number(entry.saturday) +
                Number(entry.dominical);
              return (
                subtotal +
                days * Number(worker.dailyWage) +
                Number(entry.overtimeAmount) -
                Number(entry.afpDiscount) -
                Number(entry.advanceDiscount)
              );
            }, 0),
          0,
        ) ?? 0;
      const adjustments =
        payroll?.workers.reduce(
          (total, worker) =>
            total +
            Number(worker.additionalAmount) +
            Number(worker.liquidationAmount) +
            Number(worker.sundayDinnerAmount),
          0,
        ) ?? 0;

      return {
        weekId: week.weekId,
        startDate: week.startDate,
        endDate: week.endDate,
        initialized: Boolean(payroll),
        projectCount: payroll?.projects.length ?? 0,
        workerCount: payroll?.workers.length ?? 0,
        totalAmount: this.round(projectTotal + adjustments),
      };
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Semanas de planilla obtenidas correctamente.',
      data,
    };
  }

  async findOne(weekId: number) {
    const week = await this.getWeek(weekId);
    const [payroll, activeProjects, availableWorkers, previousPayroll] =
      await Promise.all([
        this.prisma.generalPayroll.findUnique({
          where: { weekId },
          include: payrollInclude,
        }),
        this.prisma.project.findMany({
          where: { status: 'active', deletedAt: null },
          select: { projectId: true, name: true, code: true },
          orderBy: { name: 'asc' },
        }),
        this.prisma.worker.findMany({
          where: {
            deletedAt: null,
            workerType: { in: ['laborer', 'technician'] },
          },
          select: {
            workerId: true,
            fullName: true,
            dni: true,
            workerType: true,
            dailyWages: {
              where: { validFromDate: { lte: week.startDate } },
              orderBy: { validFromDate: 'desc' },
              take: 1,
              select: { amount: true },
            },
          },
          orderBy: { fullName: 'asc' },
        }),
        this.prisma.generalPayroll.findFirst({
          where: { week: { startDate: { lt: week.startDate } } },
          orderBy: { week: { startDate: 'desc' } },
          select: { weekId: true, _count: { select: { workers: true } } },
        }),
      ]);

    return {
      statusCode: HttpStatus.OK,
      message: 'Planilla semanal obtenida correctamente.',
      data: {
        initialized: Boolean(payroll),
        week,
        previousPayrollWeekId:
          previousPayroll && previousPayroll._count.workers > 0
            ? previousPayroll.weekId
            : null,
        activeProjects,
        availableWorkers: availableWorkers.map(({ dailyWages, ...worker }) => ({
          ...worker,
          currentDailyWage: Number(dailyWages[0]?.amount ?? 0),
        })),
        payroll: payroll ? this.serializePayroll(payroll) : null,
      },
    };
  }

  async initialize(weekId: number, dto: InitializeGeneralPayrollDto) {
    const week = await this.getWeek(weekId);
    let payroll = await this.prisma.generalPayroll.upsert({
      where: { weekId },
      create: { weekId },
      update: {},
    });

    const rosterCount = await this.prisma.generalPayrollWorker.count({
      where: { generalPayrollId: payroll.generalPayrollId },
    });

    if (dto.copyPreviousWorkers && rosterCount === 0) {
      const previous = await this.prisma.generalPayroll.findFirst({
        where: { week: { startDate: { lt: week.startDate } } },
        orderBy: { week: { startDate: 'desc' } },
        include: { workers: true },
      });

      if (previous?.workers.length) {
        await this.prisma.generalPayrollWorker.createMany({
          data: previous.workers.map((worker) => ({
            generalPayrollId: payroll.generalPayrollId,
            workerId: worker.workerId,
            group: worker.group,
            dailyWage: worker.dailyWage,
            displayOrder: worker.displayOrder,
          })),
          skipDuplicates: true,
        });
      }
    }

    payroll = await this.prisma.generalPayroll.findUniqueOrThrow({
      where: { weekId },
    });
    await this.ensureEntryMatrix(payroll.generalPayrollId);
    return this.findOne(weekId);
  }

  async configure(weekId: number, dto: ConfigureGeneralPayrollDto) {
    const week = await this.getWeek(weekId);
    const payroll = await this.prisma.generalPayroll.upsert({
      where: { weekId },
      create: { weekId },
      update: {},
    });

    const [validProjects, validWorkers] = await Promise.all([
      this.prisma.project.findMany({
        where: {
          projectId: { in: dto.projectIds },
          status: 'active',
          deletedAt: null,
        },
        select: { projectId: true },
      }),
      this.prisma.worker.findMany({
        where: {
          workerId: { in: dto.workers.map((worker) => worker.workerId) },
          deletedAt: null,
          workerType: { in: ['laborer', 'technician'] },
        },
        select: {
          workerId: true,
          dailyWages: {
            where: { validFromDate: { lte: week.startDate } },
            orderBy: { validFromDate: 'desc' },
            take: 1,
            select: { amount: true },
          },
        },
      }),
    ]);

    if (validProjects.length !== dto.projectIds.length) {
      throw new BadRequestException(
        'Uno o más proyectos no existen, fueron eliminados o no están activos.',
      );
    }
    if (validWorkers.length !== dto.workers.length) {
      throw new BadRequestException(
        'Uno o más trabajadores no existen o fueron eliminados.',
      );
    }

    const wageByWorker = new Map(
      validWorkers.map((worker) => [
        worker.workerId,
        Number(worker.dailyWages[0]?.amount ?? 0),
      ]),
    );

    await this.prisma.$transaction(async (transaction) => {
      await transaction.generalPayrollProject.deleteMany({
        where: {
          generalPayrollId: payroll.generalPayrollId,
          projectId: { notIn: dto.projectIds },
        },
      });
      await transaction.generalPayrollWorker.deleteMany({
        where: {
          generalPayrollId: payroll.generalPayrollId,
          workerId: { notIn: dto.workers.map((worker) => worker.workerId) },
        },
      });

      await Promise.all(
        dto.projectIds.map((projectId, displayOrder) =>
          transaction.generalPayrollProject.upsert({
            where: {
              generalPayrollId_projectId: {
                generalPayrollId: payroll.generalPayrollId,
                projectId,
              },
            },
            create: {
              generalPayrollId: payroll.generalPayrollId,
              projectId,
              displayOrder,
            },
            update: { displayOrder },
          }),
        ),
      );

      await Promise.all(
        dto.workers.map((worker, displayOrder) =>
          transaction.generalPayrollWorker.upsert({
            where: {
              generalPayrollId_workerId: {
                generalPayrollId: payroll.generalPayrollId,
                workerId: worker.workerId,
              },
            },
            create: {
              generalPayrollId: payroll.generalPayrollId,
              workerId: worker.workerId,
              group: worker.group,
              dailyWage: wageByWorker.get(worker.workerId) ?? 0,
              displayOrder,
            },
            update: { group: worker.group, displayOrder },
          }),
        ),
      );
    });

    await this.ensureEntryMatrix(payroll.generalPayrollId);
    return this.findOne(weekId);
  }

  async save(weekId: number, dto: SaveGeneralPayrollDto) {
    const payroll = await this.prisma.generalPayroll.findUnique({
      where: { weekId },
      select: { generalPayrollId: true },
    });
    if (!payroll) {
      throw new NotFoundException('La planilla semanal aún no fue creada.');
    }

    const [workerCount, payrollEntries] = await Promise.all([
      this.prisma.generalPayrollWorker.count({
        where: {
          generalPayrollId: payroll.generalPayrollId,
          generalPayrollWorkerId: {
            in: dto.workers.map((worker) => worker.generalPayrollWorkerId),
          },
        },
      }),
      this.prisma.generalPayrollEntry.findMany({
        where: {
          payrollWorker: { generalPayrollId: payroll.generalPayrollId },
        },
        select: {
          generalPayrollEntryId: true,
          generalPayrollWorkerId: true,
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: true,
          dominical: true,
          payrollWorker: {
            select: { worker: { select: { fullName: true } } },
          },
          payrollProject: {
            select: { project: { select: { name: true } } },
          },
        },
      }),
    ]);

    const payrollEntryIds = new Set(
      payrollEntries.map((entry) => entry.generalPayrollEntryId),
    );
    if (
      workerCount !== dto.workers.length ||
      dto.entries.some(
        (entry) => !payrollEntryIds.has(entry.generalPayrollEntryId),
      )
    ) {
      throw new BadRequestException(
        'La planilla cambió mientras se editaba. Actualiza la página e inténtalo nuevamente.',
      );
    }

    this.validateUniqueAttendance(payrollEntries, dto.entries);

    await this.prisma.$transaction([
      ...dto.workers.map((worker) =>
        this.prisma.generalPayrollWorker.update({
          where: {
            generalPayrollWorkerId: worker.generalPayrollWorkerId,
          },
          data: {
            dailyWage: worker.dailyWage,
            additionalAmount: worker.additionalAmount,
            liquidationAmount: worker.liquidationAmount,
            sundayDinnerAmount: worker.sundayDinnerAmount,
          },
        }),
      ),
      ...dto.entries.map((entry) =>
        this.prisma.generalPayrollEntry.update({
          where: { generalPayrollEntryId: entry.generalPayrollEntryId },
          data: {
            monday: entry.monday,
            tuesday: entry.tuesday,
            wednesday: entry.wednesday,
            thursday: entry.thursday,
            friday: entry.friday,
            saturday: entry.saturday,
            dominical: entry.dominical,
            overtimeAmount: entry.overtimeAmount,
            afpDiscount: entry.afpDiscount,
            advanceDiscount: entry.advanceDiscount,
          },
        }),
      ),
    ]);

    return this.findOne(weekId);
  }

  private async getWeek(weekId: number) {
    const week = await this.prisma.week.findUnique({ where: { weekId } });
    if (!week) throw new NotFoundException('La semana indicada no existe.');
    return week;
  }

  private async ensureEntryMatrix(generalPayrollId: number) {
    const [projects, workers] = await Promise.all([
      this.prisma.generalPayrollProject.findMany({
        where: { generalPayrollId },
        select: { generalPayrollProjectId: true },
      }),
      this.prisma.generalPayrollWorker.findMany({
        where: { generalPayrollId },
        select: { generalPayrollWorkerId: true },
      }),
    ]);
    if (!projects.length || !workers.length) return;

    await this.prisma.generalPayrollEntry.createMany({
      data: projects.flatMap((project) =>
        workers.map((worker) => ({
          generalPayrollProjectId: project.generalPayrollProjectId,
          generalPayrollWorkerId: worker.generalPayrollWorkerId,
        })),
      ),
      skipDuplicates: true,
    });
  }

  private validateUniqueAttendance(
    payrollEntries: Array<{
      generalPayrollEntryId: number;
      generalPayrollWorkerId: number;
      monday: Prisma.Decimal;
      tuesday: Prisma.Decimal;
      wednesday: Prisma.Decimal;
      thursday: Prisma.Decimal;
      friday: Prisma.Decimal;
      saturday: Prisma.Decimal;
      dominical: Prisma.Decimal;
      payrollWorker: { worker: { fullName: string } };
      payrollProject: { project: { name: string } };
    }>,
    updates: SaveGeneralPayrollEntryDto[],
  ) {
    const updateById = new Map(
      updates.map((entry) => [entry.generalPayrollEntryId, entry]),
    );
    const occupied = new Map<string, string>();

    for (const storedEntry of payrollEntries) {
      const update = updateById.get(storedEntry.generalPayrollEntryId);
      for (const [field, label] of attendanceFields) {
        const value = update ? update[field] : Number(storedEntry[field]);
        if (value <= 0) continue;

        const key = `${storedEntry.generalPayrollWorkerId}:${field}`;
        const occupiedProject = occupied.get(key);
        if (occupiedProject) {
          throw new BadRequestException(
            `${storedEntry.payrollWorker.worker.fullName} ya tiene asistencia el ${label} en ${occupiedProject}.`,
          );
        }
        occupied.set(key, storedEntry.payrollProject.project.name);
      }
    }
  }

  private serializePayroll(payroll: PayrollWithRelations) {
    return {
      generalPayrollId: payroll.generalPayrollId,
      weekId: payroll.weekId,
      projects: payroll.projects.map((project) => ({
        generalPayrollProjectId: project.generalPayrollProjectId,
        projectId: project.projectId,
        displayOrder: project.displayOrder,
        project: project.project,
        entries: project.entries.map((entry) => this.serializeEntry(entry)),
      })),
      workers: payroll.workers.map((worker) => ({
        generalPayrollWorkerId: worker.generalPayrollWorkerId,
        workerId: worker.workerId,
        group: worker.group,
        displayOrder: worker.displayOrder,
        dailyWage: Number(worker.dailyWage),
        additionalAmount: Number(worker.additionalAmount),
        liquidationAmount: Number(worker.liquidationAmount),
        sundayDinnerAmount: Number(worker.sundayDinnerAmount),
        worker: worker.worker,
      })),
    };
  }

  private serializeEntry(entry: PayrollEntry) {
    return {
      generalPayrollEntryId: entry.generalPayrollEntryId,
      generalPayrollProjectId: entry.generalPayrollProjectId,
      generalPayrollWorkerId: entry.generalPayrollWorkerId,
      monday: Number(entry.monday) > 0 ? 1 : 0,
      tuesday: Number(entry.tuesday) > 0 ? 1 : 0,
      wednesday: Number(entry.wednesday) > 0 ? 1 : 0,
      thursday: Number(entry.thursday) > 0 ? 1 : 0,
      friday: Number(entry.friday) > 0 ? 1 : 0,
      saturday: Number(entry.saturday) > 0 ? 1 : 0,
      dominical: Number(entry.dominical) > 0 ? 1 : 0,
      overtimeAmount: Number(entry.overtimeAmount),
      afpDiscount: Number(entry.afpDiscount),
      advanceDiscount: Number(entry.advanceDiscount),
    };
  }

  private round(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
