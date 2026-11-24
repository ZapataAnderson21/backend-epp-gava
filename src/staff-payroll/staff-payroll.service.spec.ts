import { BadRequestException, ConflictException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma, WorkerType } from 'src/generated/prisma';
import { endpointPermissions } from '../permissions/endpoint-policy';
import { PrismaService } from '../prisma/prisma.service';
import { StaffPayrollExcelService } from './staff-payroll-excel.service';
import { StaffPayrollService } from './staff-payroll.service';

const staffWorker = {
  workerId: 7,
  fullName: 'Ana Torres',
  dni: '12345678',
  workerType: WorkerType.engineer,
  deletedAt: null,
  staffPayrollProfile: {
    monthlyBaseRemuneration: new Prisma.Decimal('3500.00'),
  },
};

describe('StaffPayrollService', () => {
  it('queries only active STAFF worker types and reports pending profiles', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValue([{ ...staffWorker, staffPayrollProfile: null }]);
    const prisma = {
      worker: {
        findMany,
        count: jest.fn().mockResolvedValue(1),
      },
    } as unknown as PrismaService;
    const result = await new StaffPayrollService(prisma).listPeople({
      page: 1,
      pageSize: 10,
      order: 'asc',
    });
    expect(findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        workerType: {
          in: [
            WorkerType.engineer,
            WorkerType.administrator,
            WorkerType.manager,
          ],
        },
      },
      include: { staffPayrollProfile: true },
      orderBy: [{ fullName: 'asc' }, { workerId: 'asc' }],
      skip: 0,
      take: 10,
    });
    expect(result.data.items[0]).toMatchObject({
      monthlyBaseRemuneration: null,
      remunerationConfigured: false,
    });
  });

  it('does not configure remuneration for a non-STAFF worker', async () => {
    const prisma = {
      worker: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    await expect(
      new StaffPayrollService(prisma).configureProfile(2, {
        monthlyBaseRemuneration: 1000,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('upserts one remuneration profile per worker', async () => {
    const upsert = jest.fn().mockResolvedValue({
      staffPayrollProfileId: 1,
      workerId: 7,
      monthlyBaseRemuneration: new Prisma.Decimal('3700'),
    });
    const prisma = {
      worker: { findFirst: jest.fn().mockResolvedValue(staffWorker) },
      staffPayrollProfile: { upsert },
    } as unknown as PrismaService;
    const result = await new StaffPayrollService(prisma).configureProfile(7, {
      monthlyBaseRemuneration: 3700,
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workerId: 7 } }),
    );
    expect(result.data.monthlyBaseRemuneration).toBe('3700.00');
  });

  it('reports duplicate periods as conflicts', async () => {
    const prisma = {
      staffPayroll: {
        create: jest.fn().mockRejectedValue({ code: 'P2002' }),
      },
    } as unknown as PrismaService;
    await expect(
      new StaffPayrollService(prisma).createPeriod({ year: 2026, month: 11 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks insertion when a selected STAFF worker has no profile', async () => {
    const tx = {
      staffPayroll: {
        findUnique: jest.fn().mockResolvedValue({ staffPayrollId: 3 }),
      },
      worker: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ ...staffWorker, staffPayrollProfile: null }]),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    await expect(
      new StaffPayrollService(prisma).addEntries(2026, 11, { workerIds: [7] }),
    ).rejects.toThrow('Configura la remuneración mensual');
  });

  it('creates immutable worker and remuneration snapshots once', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      staffPayroll: {
        findUnique: jest.fn().mockResolvedValue({ staffPayrollId: 3 }),
      },
      worker: { findMany: jest.fn().mockResolvedValue([staffWorker]) },
      staffPayrollEntry: { createMany },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    await new StaffPayrollService(prisma).addEntries(2026, 11, {
      workerIds: [7],
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          workerNameSnapshot: 'Ana Torres',
          workerDniSnapshot: '12345678',
          workerTypeSnapshot: WorkerType.engineer,
          baseRemuneration:
            staffWorker.staffPayrollProfile.monthlyBaseRemuneration,
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('preserves omitted entry fields during partial updates', async () => {
    const current = {
      staffPayrollEntryId: 4,
      staffPayrollId: 3,
      workerId: 7,
      workerNameSnapshot: 'Ana Torres',
      workerDniSnapshot: '12345678',
      workerTypeSnapshot: 'engineer',
      baseRemuneration: new Prisma.Decimal('3500'),
      additionalIncome: new Prisma.Decimal('100'),
      manualDiscounts: new Prisma.Decimal('50'),
      observations: 'Original',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const update = jest.fn().mockResolvedValue({
      ...current,
      additionalIncome: new Prisma.Decimal('200'),
    });
    const prisma = {
      staffPayrollEntry: {
        findUnique: jest.fn().mockResolvedValue(current),
        update,
      },
    } as unknown as PrismaService;
    await new StaffPayrollService(prisma).updateEntry(4, {
      additionalIncome: 200,
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { additionalIncome: new Prisma.Decimal('200') },
      }),
    );
  });

  it('prepares a new period with every active STAFF worker and pending salaries', async () => {
    const findMany = jest.fn().mockResolvedValue([
      staffWorker,
      {
        ...staffWorker,
        workerId: 8,
        fullName: 'Luis Pérez',
        workerType: WorkerType.manager,
        staffPayrollProfile: null,
      },
    ]);
    const prisma = {
      staffPayroll: { findUnique: jest.fn().mockResolvedValue(null) },
      worker: { findMany },
    } as unknown as PrismaService;

    const result = await new StaffPayrollService(prisma).preparePeriod(
      2026,
      11,
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          workerType: {
            in: [
              WorkerType.engineer,
              WorkerType.administrator,
              WorkerType.manager,
            ],
          },
        },
      }),
    );
    expect(result.data).toMatchObject({
      exists: false,
      year: 2026,
      month: 11,
      rows: [
        expect.objectContaining({
          workerId: 7,
          included: true,
          baseRemuneration: '3500.00',
          habitualBaseRemuneration: '3500.00',
        }),
        expect.objectContaining({
          workerId: 8,
          included: true,
          baseRemuneration: null,
          habitualBaseRemuneration: null,
        }),
      ],
    });
  });

  it('prepares an existing period from snapshots without recalculating historical rows', async () => {
    const historicalEntry = {
      staffPayrollEntryId: 4,
      staffPayrollId: 3,
      workerId: 7,
      workerNameSnapshot: 'Ana Torres',
      workerDniSnapshot: '12345678',
      workerTypeSnapshot: 'engineer',
      baseRemuneration: new Prisma.Decimal('2500'),
      additionalIncome: new Prisma.Decimal('100'),
      manualDiscounts: new Prisma.Decimal('50'),
      observations: 'Histórico',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const prisma = {
      staffPayroll: {
        findUnique: jest.fn().mockResolvedValue({
          staffPayrollId: 3,
          year: 2026,
          month: 10,
          entries: [historicalEntry],
        }),
      },
      worker: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;

    const result = await new StaffPayrollService(prisma).preparePeriod(
      2026,
      10,
    );

    expect(result.data.rows[0]).toMatchObject({
      persisted: true,
      included: true,
      baseRemuneration: '2500.00',
      habitualBaseRemuneration: null,
      profileEligible: false,
      netAmount: '2550.00',
    });
  });

  it('saves multiple rows atomically and updates habitual salary only when explicit', async () => {
    const createdEntry = {
      staffPayrollEntryId: 4,
      staffPayrollId: 3,
      workerId: 7,
      workerNameSnapshot: 'Ana Torres',
      workerDniSnapshot: '12345678',
      workerTypeSnapshot: 'engineer',
      baseRemuneration: new Prisma.Decimal('3600'),
      additionalIncome: new Prisma.Decimal('100'),
      manualDiscounts: new Prisma.Decimal('50'),
      observations: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      staffPayroll: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({
          staffPayrollId: 3,
          year: 2026,
          month: 11,
        }),
      },
      staffPayrollEntry: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue(createdEntry),
        update: jest.fn(),
      },
      worker: { findMany: jest.fn().mockResolvedValue([staffWorker]) },
      staffPayrollProfile: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
      staffPayroll: {
        findUnique: jest.fn().mockResolvedValue({
          staffPayrollId: 3,
          year: 2026,
          month: 11,
          createdAt: new Date(),
          updatedAt: new Date(),
          entries: [createdEntry],
        }),
      },
    } as unknown as PrismaService;

    const result = await new StaffPayrollService(prisma).savePeriod({
      year: 2026,
      month: 11,
      rows: [
        {
          workerId: 7,
          included: true,
          baseRemuneration: 3600,
          additionalIncome: 100,
          manualDiscounts: 50,
          observations: null,
          updateProfile: false,
        },
      ],
    });

    expect(tx.staffPayrollEntry.create).toHaveBeenCalledWith({
      data: {
        staffPayrollId: 3,
        workerId: 7,
        workerNameSnapshot: 'Ana Torres',
        workerDniSnapshot: '12345678',
        workerTypeSnapshot: WorkerType.engineer,
        baseRemuneration: new Prisma.Decimal('3600'),
        additionalIncome: new Prisma.Decimal('100'),
        manualDiscounts: new Prisma.Decimal('50'),
        observations: null,
      },
    });
    expect(tx.staffPayrollProfile.upsert).not.toHaveBeenCalled();
    expect(result.data.totalNetAmount).toBe('3650.00');
  });

  it('creates a missing profile in the same transaction as its first entry', async () => {
    const workerWithoutProfile = {
      ...staffWorker,
      staffPayrollProfile: null,
    };
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      staffPayroll: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({
          staffPayrollId: 3,
          year: 2026,
          month: 11,
        }),
      },
      staffPayrollEntry: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn(),
      },
      worker: {
        findMany: jest.fn().mockResolvedValue([workerWithoutProfile]),
      },
      staffPayrollProfile: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
      staffPayroll: {
        findUnique: jest.fn().mockResolvedValue({
          staffPayrollId: 3,
          year: 2026,
          month: 11,
          createdAt: new Date(),
          updatedAt: new Date(),
          entries: [],
        }),
      },
    } as unknown as PrismaService;

    await new StaffPayrollService(prisma).savePeriod({
      year: 2026,
      month: 11,
      rows: [
        {
          workerId: 7,
          included: true,
          baseRemuneration: 3200,
          additionalIncome: 0,
          manualDiscounts: 0,
          observations: null,
          updateProfile: false,
        },
      ],
    });

    expect(tx.staffPayrollProfile.upsert).toHaveBeenCalledWith({
      where: { workerId: 7 },
      create: {
        workerId: 7,
        monthlyBaseRemuneration: new Prisma.Decimal('3200'),
      },
      update: {},
    });
  });

  it('updates the habitual salary explicitly without replacing worker snapshots', async () => {
    const existingEntry = {
      staffPayrollEntryId: 4,
      staffPayrollId: 3,
      workerId: 7,
      workerNameSnapshot: 'Nombre histórico',
      workerDniSnapshot: '87654321',
      workerTypeSnapshot: 'engineer',
      baseRemuneration: new Prisma.Decimal('3500'),
      additionalIncome: new Prisma.Decimal('0'),
      manualDiscounts: new Prisma.Decimal('0'),
      observations: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const entryUpdate = jest.fn().mockResolvedValue(existingEntry);
    const profileUpsert = jest.fn().mockResolvedValue({});
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      staffPayroll: {
        findUnique: jest.fn().mockResolvedValue({ staffPayrollId: 3 }),
        upsert: jest.fn().mockResolvedValue({ staffPayrollId: 3 }),
      },
      staffPayrollEntry: {
        findMany: jest.fn().mockResolvedValue([existingEntry]),
        create: jest.fn(),
        update: entryUpdate,
      },
      worker: { findMany: jest.fn().mockResolvedValue([staffWorker]) },
      staffPayrollProfile: { upsert: profileUpsert },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
      staffPayroll: {
        findUnique: jest.fn().mockResolvedValue({
          staffPayrollId: 3,
          year: 2026,
          month: 11,
          createdAt: new Date(),
          updatedAt: new Date(),
          entries: [existingEntry],
        }),
      },
    } as unknown as PrismaService;

    await new StaffPayrollService(prisma).savePeriod({
      year: 2026,
      month: 11,
      expectExisting: true,
      rows: [
        {
          workerId: 7,
          included: true,
          baseRemuneration: 4000,
          additionalIncome: 0,
          manualDiscounts: 0,
          observations: null,
          updateProfile: true,
        },
      ],
    });

    expect(profileUpsert).toHaveBeenCalledWith({
      where: { workerId: 7 },
      create: {
        workerId: 7,
        monthlyBaseRemuneration: new Prisma.Decimal('4000'),
      },
      update: {
        monthlyBaseRemuneration: new Prisma.Decimal('4000'),
      },
    });
    expect(entryUpdate).toHaveBeenCalledWith({
      where: { staffPayrollEntryId: 4 },
      data: {
        baseRemuneration: new Prisma.Decimal('4000'),
        additionalIncome: new Prisma.Decimal('0'),
        manualDiscounts: new Prisma.Decimal('0'),
        observations: null,
      },
    });
  });

  it('does not overwrite a period created concurrently from the new flow', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      staffPayroll: {
        findUnique: jest.fn().mockResolvedValue({ staffPayrollId: 3 }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;

    await expect(
      new StaffPayrollService(prisma).savePeriod({
        year: 2026,
        month: 11,
        expectExisting: false,
        rows: [
          {
            workerId: 7,
            included: true,
            baseRemuneration: 3200,
            additionalIncome: 0,
            manualDiscounts: 0,
            observations: null,
            updateProfile: false,
          },
        ],
      }),
    ).rejects.toThrow('Ya existe una planilla');
  });
});

describe('Phase 4 security, migration and Excel', () => {
  it('requires finance plus the independent STAFF payroll permission', () => {
    expect(
      endpointPermissions('StaffPayrollController', 'listPeople', 'GET'),
    ).toEqual([['staffPayroll.view'], ['finance.view']]);
    expect(
      endpointPermissions('StaffPayrollController', 'createPeriod', 'POST'),
    ).toEqual([
      ['staffPayroll.view'],
      ['finance.view'],
      ['staffPayroll.manage'],
    ]);
    expect(
      endpointPermissions('StaffPayrollController', 'savePeriod', 'PUT'),
    ).toEqual([
      ['staffPayroll.view'],
      ['finance.view'],
      ['staffPayroll.manage'],
    ]);
    expect(
      endpointPermissions('StaffPayrollController', 'exportPeriod', 'GET'),
    ).toEqual([
      ['staffPayroll.view'],
      ['finance.view'],
      ['staffPayroll.export'],
    ]);
  });

  it('migrates unspecified safely and rebuilds the enum without CASCADE', () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        'prisma/migrations/20261117183000_add_staff_monthly_payroll/migration.sql',
      ),
      'utf8',
    );
    expect(sql).toContain('WHERE "workerType" = \'unspecified\'');
    expect(sql).toContain('SET "workerType" = \'engineer\'');
    expect(sql).toContain('ALTER COLUMN "workerType" DROP DEFAULT');
    expect(sql).not.toMatch(/DROP\\s+CASCADE/i);
    expect(sql).not.toMatch(/TRUNCATE|DROP\\s+TABLE/i);
  });

  it('exports the monthly control with totals and a non-official notice', async () => {
    const payrollService = {
      getExportData: jest.fn().mockResolvedValue({
        year: 2026,
        month: 11,
        entries: [
          {
            workerNameSnapshot: 'Ana Torres',
            workerDniSnapshot: '12345678',
            workerTypeSnapshot: 'engineer',
            baseRemuneration: '3500.00',
            additionalIncome: '100.00',
            manualDiscounts: '50.00',
            grossAmount: '3600.00',
            netAmount: '3550.00',
            observations: null,
          },
        ],
        totalBaseRemuneration: '3500.00',
        totalAdditionalIncome: '100.00',
        totalDiscounts: '50.00',
        totalGrossAmount: '3600.00',
        totalNetAmount: '3550.00',
      }),
    } as unknown as StaffPayrollService;
    const result = await new StaffPayrollExcelService(
      payrollService,
    ).generatePeriodWorkbook(2026, 11);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.buffer);
    const sheet = workbook.getWorksheet('Control mensual STAFF')!;
    expect(sheet.getCell('A1').value).toBe('Control mensual STAFF — GAVA C&C');
    expect(sheet.getCell('A3').value).toContain('No constituye');
    expect(sheet.getCell('A5').value).toBe('Ana Torres');
    expect(sheet.getCell('H5').value).toBe(3550);
  });
});
