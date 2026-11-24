import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WorkerType as PrismaWorkerType } from 'src/generated/prisma';
import { buildPaginatedData, getPaginationArgs } from 'src/common/pagination';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AddStaffPayrollEntriesDto,
  ConfigureStaffPayrollProfileDto,
  CreateStaffPayrollDto,
  ListStaffPayrollsQueryDto,
  ListStaffPeopleQueryDto,
  SaveStaffPayrollDto,
  UpdateStaffPayrollEntryDto,
} from './dto';
import {
  calculateStaffPayrollTotals,
  decimal,
  money,
} from './staff-payroll.calculations';

const STAFF_TYPES: PrismaWorkerType[] = [
  PrismaWorkerType.engineer,
  PrismaWorkerType.administrator,
  PrismaWorkerType.manager,
];

@Injectable()
export class StaffPayrollService {
  constructor(private readonly prisma: PrismaService) {}

  async listPeople(query: ListStaffPeopleQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.WorkerWhereInput = {
      deletedAt: null,
      workerType: { in: STAFF_TYPES },
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { dni: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const { skip, take } = getPaginationArgs(query);
    const [workers, totalItems] = await Promise.all([
      this.prisma.worker.findMany({
        where,
        include: { staffPayrollProfile: true },
        orderBy: [{ fullName: query.order }, { workerId: 'asc' }],
        skip,
        take,
      }),
      this.prisma.worker.count({ where }),
    ]);
    return this.ok(
      buildPaginatedData(
        workers.map((worker) => this.mapPerson(worker)),
        totalItems,
        query,
      ),
      'Personal STAFF recuperado con éxito.',
    );
  }

  async configureProfile(
    workerId: number,
    dto: ConfigureStaffPayrollProfileDto,
  ) {
    const worker = await this.prisma.worker.findFirst({
      where: {
        workerId,
        deletedAt: null,
        workerType: { in: STAFF_TYPES },
      },
    });
    if (!worker) {
      throw new BadRequestException(
        'El trabajador no está activo o no pertenece al personal STAFF.',
      );
    }
    const profile = await this.prisma.staffPayrollProfile.upsert({
      where: { workerId },
      create: {
        workerId,
        monthlyBaseRemuneration: dto.monthlyBaseRemuneration,
      },
      update: {
        monthlyBaseRemuneration: dto.monthlyBaseRemuneration,
      },
    });
    return this.ok(
      {
        ...profile,
        monthlyBaseRemuneration: money(profile.monthlyBaseRemuneration),
      },
      'Remuneración mensual configurada con éxito.',
    );
  }

  async listPeriods(query: ListStaffPayrollsQueryDto) {
    const { skip, take } = getPaginationArgs(query);
    const [periods, totalItems] = await Promise.all([
      this.prisma.staffPayroll.findMany({
        include: {
          entries: {
            select: {
              baseRemuneration: true,
              additionalIncome: true,
              manualDiscounts: true,
            },
          },
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        skip,
        take,
      }),
      this.prisma.staffPayroll.count(),
    ]);
    const items = periods.map(({ entries, ...period }) => ({
      ...period,
      workerCount: entries.length,
      ...this.totalEntries(entries),
    }));
    return this.ok(
      buildPaginatedData(items, totalItems, query),
      'Períodos mensuales recuperados con éxito.',
    );
  }

  async createPeriod(dto: CreateStaffPayrollDto) {
    try {
      const payroll = await this.prisma.staffPayroll.create({ data: dto });
      return {
        statusCode: HttpStatus.CREATED,
        data: { ...payroll, workerCount: 0, ...this.totalEntries([]) },
        message: 'Planilla mensual creada con éxito.',
      };
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException(
          'Ya existe una planilla para el mes y año indicados.',
        );
      }
      throw error;
    }
  }

  async preparePeriod(year: number, month: number) {
    this.assertPeriod(year, month);
    const [period, workers] = await Promise.all([
      this.prisma.staffPayroll.findUnique({
        where: { year_month: { year, month } },
        include: {
          entries: {
            orderBy: [
              { workerNameSnapshot: 'asc' },
              { staffPayrollEntryId: 'asc' },
            ],
          },
        },
      }),
      this.prisma.worker.findMany({
        where: {
          deletedAt: null,
          workerType: { in: STAFF_TYPES },
        },
        include: { staffPayrollProfile: true },
        orderBy: [{ fullName: 'asc' }, { workerId: 'asc' }],
      }),
    ]);
    const currentWorkers = new Map(
      workers.map((worker) => [worker.workerId, worker]),
    );
    const persistedIds = new Set(
      period?.entries.map((entry) => entry.workerId) ?? [],
    );
    const persistedRows =
      period?.entries.map((entry) => {
        const current = currentWorkers.get(entry.workerId);
        return {
          ...this.mapEntry(entry),
          persisted: true,
          included: true,
          profileEligible: Boolean(current),
          habitualBaseRemuneration: current?.staffPayrollProfile
            ? money(current.staffPayrollProfile.monthlyBaseRemuneration)
            : null,
        };
      }) ?? [];
    const eligibleRows = workers
      .filter((worker) => !persistedIds.has(worker.workerId))
      .map((worker) => {
        const base = worker.staffPayrollProfile
          ? money(worker.staffPayrollProfile.monthlyBaseRemuneration)
          : null;
        return {
          workerId: worker.workerId,
          workerNameSnapshot: worker.fullName,
          workerDniSnapshot: worker.dni,
          workerTypeSnapshot: worker.workerType,
          baseRemuneration: base,
          habitualBaseRemuneration: base,
          additionalIncome: '0.00',
          manualDiscounts: '0.00',
          grossAmount: base,
          netAmount: base,
          observations: null,
          persisted: false,
          included: !period,
          profileEligible: true,
        };
      });
    const rows = [...persistedRows, ...eligibleRows].sort((left, right) =>
      left.workerNameSnapshot.localeCompare(right.workerNameSnapshot, 'es'),
    );
    return this.ok(
      {
        exists: Boolean(period),
        staffPayrollId: period?.staffPayrollId ?? null,
        year,
        month,
        rows,
      },
      'Planilla mensual preparada con éxito.',
    );
  }

  async savePeriod(dto: SaveStaffPayrollDto) {
    this.assertPeriod(dto.year, dto.month);
    const selectedRows = dto.rows.filter((row) => row.included);
    if (!selectedRows.length) {
      throw new BadRequestException(
        'Incluye al menos un trabajador en la planilla.',
      );
    }
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const periodKey = dto.year * 100 + dto.month;
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(94241, ${periodKey}::int)`;
          const currentPeriod = await tx.staffPayroll.findUnique({
            where: { year_month: { year: dto.year, month: dto.month } },
          });
          if (currentPeriod && dto.expectExisting !== true) {
            throw new ConflictException(
              'Ya existe una planilla para el mes y año indicados.',
            );
          }
          if (!currentPeriod && dto.expectExisting === true) {
            throw new ConflictException(
              'La planilla ya no existe. Regresa al listado e inténtalo nuevamente.',
            );
          }
          const period = await tx.staffPayroll.upsert({
            where: { year_month: { year: dto.year, month: dto.month } },
            create: { year: dto.year, month: dto.month },
            update: {},
          });
          const workerIds = selectedRows.map((row) => row.workerId);
          const [existingEntries, currentWorkers] = await Promise.all([
            tx.staffPayrollEntry.findMany({
              where: {
                staffPayrollId: period.staffPayrollId,
                workerId: { in: workerIds },
              },
            }),
            tx.worker.findMany({
              where: {
                workerId: { in: workerIds },
                deletedAt: null,
                workerType: { in: STAFF_TYPES },
              },
              include: { staffPayrollProfile: true },
            }),
          ]);
          const entriesByWorker = new Map(
            existingEntries.map((entry) => [entry.workerId, entry]),
          );
          const workersById = new Map(
            currentWorkers.map((worker) => [worker.workerId, worker]),
          );

          for (const row of selectedRows) {
            const existing = entriesByWorker.get(row.workerId);
            const worker = workersById.get(row.workerId);
            if (!existing && !worker) {
              throw new BadRequestException(
                'Uno o más trabajadores no están activos o no pertenecen a STAFF.',
              );
            }
            if (row.updateProfile && !worker) {
              throw new BadRequestException(
                'El sueldo habitual solo puede actualizarse para personal STAFF activo.',
              );
            }
            if (row.baseRemuneration === undefined) {
              throw new BadRequestException(
                'Falta el sueldo base de ' +
                  (worker?.fullName ??
                    existing?.workerNameSnapshot ??
                    'una fila') +
                  '.',
              );
            }
            const baseRemuneration = decimal(row.baseRemuneration);
            const additionalIncome = decimal(row.additionalIncome ?? 0);
            const manualDiscounts = decimal(row.manualDiscounts ?? 0);
            calculateStaffPayrollTotals(
              baseRemuneration,
              additionalIncome,
              manualDiscounts,
            );

            if (
              worker &&
              (!worker.staffPayrollProfile || row.updateProfile === true)
            ) {
              await tx.staffPayrollProfile.upsert({
                where: { workerId: row.workerId },
                create: {
                  workerId: row.workerId,
                  monthlyBaseRemuneration: baseRemuneration,
                },
                update: row.updateProfile
                  ? { monthlyBaseRemuneration: baseRemuneration }
                  : {},
              });
            }

            const entryData = {
              baseRemuneration,
              additionalIncome,
              manualDiscounts,
              observations: row.observations ?? null,
            };
            if (existing) {
              await tx.staffPayrollEntry.update({
                where: {
                  staffPayrollEntryId: existing.staffPayrollEntryId,
                },
                data: entryData,
              });
            } else {
              await tx.staffPayrollEntry.create({
                data: {
                  staffPayrollId: period.staffPayrollId,
                  workerId: row.workerId,
                  workerNameSnapshot: worker!.fullName,
                  workerDniSnapshot: worker!.dni,
                  workerTypeSnapshot: worker!.workerType,
                  ...entryData,
                },
              });
            }
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return this.getPeriod(dto.year, dto.month);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2034') {
        throw new ConflictException(
          'La planilla cambió durante la operación. Inténtalo de nuevo.',
        );
      }
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException(
          'La planilla contiene un registro duplicado. Recarga e inténtalo nuevamente.',
        );
      }
      throw error;
    }
  }

  async getPeriod(year: number, month: number) {
    this.assertPeriod(year, month);
    const period = await this.findPeriod(year, month);
    const entries = period.entries.map((entry) => this.mapEntry(entry));
    return this.ok(
      {
        staffPayrollId: period.staffPayrollId,
        year: period.year,
        month: period.month,
        createdAt: period.createdAt,
        updatedAt: period.updatedAt,
        entries,
        workerCount: entries.length,
        ...this.totalEntries(period.entries),
      },
      'Planilla mensual recuperada con éxito.',
    );
  }

  async listEligiblePeople(year: number, month: number) {
    this.assertPeriod(year, month);
    const period = await this.prisma.staffPayroll.findUnique({
      where: { year_month: { year, month } },
      select: {
        staffPayrollId: true,
        entries: { select: { workerId: true } },
      },
    });
    if (!period) throw new NotFoundException('La planilla mensual no existe.');
    const existingIds = period.entries.map((entry) => entry.workerId);
    const workers = await this.prisma.worker.findMany({
      where: {
        deletedAt: null,
        workerType: { in: STAFF_TYPES },
        ...(existingIds.length ? { workerId: { notIn: existingIds } } : {}),
      },
      include: { staffPayrollProfile: true },
      orderBy: [{ fullName: 'asc' }, { workerId: 'asc' }],
    });
    return this.ok(
      workers.map((worker) => this.mapPerson(worker)),
      'Personal elegible recuperado con éxito.',
    );
  }

  async addEntries(
    year: number,
    month: number,
    dto: AddStaffPayrollEntriesDto,
  ) {
    this.assertPeriod(year, month);
    try {
      const insertedCount = await this.prisma.$transaction(
        async (tx) => {
          const period = await tx.staffPayroll.findUnique({
            where: { year_month: { year, month } },
          });
          if (!period) {
            throw new NotFoundException('La planilla mensual no existe.');
          }
          const workers = await tx.worker.findMany({
            where: {
              workerId: { in: dto.workerIds },
              deletedAt: null,
              workerType: { in: STAFF_TYPES },
            },
            include: { staffPayrollProfile: true },
          });
          if (workers.length !== dto.workerIds.length) {
            throw new BadRequestException(
              'Uno o más trabajadores no están activos o no pertenecen a STAFF.',
            );
          }
          const withoutProfile = workers.filter(
            (worker) => !worker.staffPayrollProfile,
          );
          if (withoutProfile.length) {
            throw new BadRequestException(
              'Configura la remuneración mensual de: ' +
                withoutProfile.map((worker) => worker.fullName).join(', ') +
                '.',
            );
          }
          const created = await tx.staffPayrollEntry.createMany({
            data: workers.map((worker) => ({
              staffPayrollId: period.staffPayrollId,
              workerId: worker.workerId,
              workerNameSnapshot: worker.fullName,
              workerDniSnapshot: worker.dni,
              workerTypeSnapshot: worker.workerType,
              baseRemuneration:
                worker.staffPayrollProfile!.monthlyBaseRemuneration,
            })),
            skipDuplicates: true,
          });
          return created.count;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return this.ok(
        { insertedCount },
        insertedCount
          ? 'Personal incorporado a la planilla con éxito.'
          : 'Los trabajadores seleccionados ya estaban incorporados.',
      );
    } catch (error) {
      if ((error as { code?: string }).code === 'P2034') {
        throw new ConflictException(
          'La planilla cambió durante la operación. Inténtalo de nuevo.',
        );
      }
      throw error;
    }
  }

  async updateEntry(entryId: number, dto: UpdateStaffPayrollEntryDto) {
    const current = await this.prisma.staffPayrollEntry.findUnique({
      where: { staffPayrollEntryId: entryId },
    });
    if (!current) {
      throw new NotFoundException('El registro mensual no existe.');
    }
    const additionalIncome =
      dto.additionalIncome === undefined
        ? current.additionalIncome
        : decimal(dto.additionalIncome);
    const manualDiscounts =
      dto.manualDiscounts === undefined
        ? current.manualDiscounts
        : decimal(dto.manualDiscounts);
    calculateStaffPayrollTotals(
      current.baseRemuneration,
      additionalIncome,
      manualDiscounts,
    );
    const updated = await this.prisma.staffPayrollEntry.update({
      where: { staffPayrollEntryId: entryId },
      data: {
        ...(dto.additionalIncome === undefined ? {} : { additionalIncome }),
        ...(dto.manualDiscounts === undefined ? {} : { manualDiscounts }),
        ...(dto.observations === undefined
          ? {}
          : { observations: dto.observations }),
      },
    });
    return this.ok(
      this.mapEntry(updated),
      'Registro mensual actualizado con éxito.',
    );
  }

  async getExportData(year: number, month: number) {
    this.assertPeriod(year, month);
    const period = await this.findPeriod(year, month);
    return {
      year,
      month,
      entries: period.entries.map((entry) => this.mapEntry(entry)),
      ...this.totalEntries(period.entries),
    };
  }

  private async findPeriod(year: number, month: number) {
    const period = await this.prisma.staffPayroll.findUnique({
      where: { year_month: { year, month } },
      include: {
        entries: {
          orderBy: [
            { workerNameSnapshot: 'asc' },
            { staffPayrollEntryId: 'asc' },
          ],
        },
      },
    });
    if (!period) throw new NotFoundException('La planilla mensual no existe.');
    return period;
  }

  private mapPerson(worker: {
    workerId: number;
    fullName: string;
    dni: string;
    workerType: PrismaWorkerType;
    staffPayrollProfile: {
      monthlyBaseRemuneration: Prisma.Decimal;
    } | null;
  }) {
    return {
      workerId: worker.workerId,
      fullName: worker.fullName,
      dni: worker.dni,
      workerType: worker.workerType,
      monthlyBaseRemuneration: worker.staffPayrollProfile
        ? money(worker.staffPayrollProfile.monthlyBaseRemuneration)
        : null,
      remunerationConfigured: Boolean(worker.staffPayrollProfile),
    };
  }

  private mapEntry(entry: {
    staffPayrollEntryId: number;
    staffPayrollId: number;
    workerId: number;
    workerNameSnapshot: string;
    workerDniSnapshot: string;
    workerTypeSnapshot: string;
    baseRemuneration: Prisma.Decimal;
    additionalIncome: Prisma.Decimal;
    manualDiscounts: Prisma.Decimal;
    observations: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      ...entry,
      baseRemuneration: money(entry.baseRemuneration),
      additionalIncome: money(entry.additionalIncome),
      manualDiscounts: money(entry.manualDiscounts),
      ...calculateStaffPayrollTotals(
        entry.baseRemuneration,
        entry.additionalIncome,
        entry.manualDiscounts,
      ),
    };
  }

  private totalEntries(
    entries: Array<{
      baseRemuneration: Prisma.Decimal;
      additionalIncome: Prisma.Decimal;
      manualDiscounts: Prisma.Decimal;
    }>,
  ) {
    const totalBase = entries.reduce(
      (sum, entry) => sum.add(entry.baseRemuneration),
      decimal(0),
    );
    const totalAdditional = entries.reduce(
      (sum, entry) => sum.add(entry.additionalIncome),
      decimal(0),
    );
    const totalDiscounts = entries.reduce(
      (sum, entry) => sum.add(entry.manualDiscounts),
      decimal(0),
    );
    const totalGross = totalBase.add(totalAdditional);
    return {
      totalBaseRemuneration: money(totalBase),
      totalAdditionalIncome: money(totalAdditional),
      totalDiscounts: money(totalDiscounts),
      totalGrossAmount: money(totalGross),
      totalNetAmount: money(totalGross.sub(totalDiscounts)),
    };
  }

  private assertPeriod(year: number, month: number) {
    if (
      !Number.isInteger(year) ||
      year < 1900 ||
      year > 9999 ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      throw new BadRequestException('El mes o año indicado no es válido.');
    }
  }

  private ok<T>(data: T, message: string) {
    return { statusCode: HttpStatus.OK, data, message };
  }
}
